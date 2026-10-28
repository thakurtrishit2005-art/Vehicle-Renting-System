
#include <crow.h>
#include <crow/multipart.h>
#include <pqxx/pqxx>

#include <cctype>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
#include <string>
#include <chrono>

std::string getDatabaseConnectionString()
{
    // Later, hosting can provide this through an environment variable.
    const char* databaseUrl = std::getenv("DATABASE_URL");

    if (databaseUrl != nullptr && databaseUrl[0] != '\0')
    {
        return databaseUrl;
    }

    // Local development uses your existing PostgreSQL database.
    return "dbname=vehicle_rental";
}

int getPort()
{
    const char* portValue = std::getenv("PORT");

    if (portValue != nullptr && portValue[0] != '\0')
    {
        try
        {
            int port = std::stoi(portValue);

            if (port >= 1 && port <= 65535)
            {
                return port;
            }
        }
        catch (...)
        {
            // Use the default port if PORT is invalid.
        }
    }

    return 18080;
}


crow::response jsonResponse(
    int status,
    const crow::json::wvalue& data)
{
    crow::response response(status);

    response.add_header("Content-Type", "application/json");
    response.add_header(
        "Access-Control-Allow-Origin",
        "http://localhost:5500"
    );
    response.add_header(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS"
    );
    response.add_header(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );
    response.body = data.dump();
    return response;
}


int main()
{
    crow::SimpleApp app;

    // Endpoint 1: basic server and database health check.
    CROW_ROUTE(app, "/api/health")
    ([]
    {
        crow::json::wvalue result;

        try
        {
            pqxx::connection connection(
                getDatabaseConnectionString()
            );

            pqxx::read_transaction transaction(connection);
            transaction.exec("SELECT 1");

            result["status"] = "ok";
            result["database"] = "connected";

            return jsonResponse(200, result);
        }
        catch (const std::exception& error)
        {
            std::cerr << "Health check failed: "
                      << error.what() << '\n';

            result["status"] = "error";
            result["database"] = "unavailable";

            return jsonResponse(503, result);
        }
    });

    // Endpoint 2: retrieve real vehicle listings from PostgreSQL.
    CROW_ROUTE(app, "/api/vehicles")
    ([]
    {
        try
        {
            pqxx::connection connection(
                getDatabaseConnectionString()
            );

            pqxx::read_transaction transaction(connection);

            auto rows = transaction.exec(
                "SELECT vehicle_code, brand, model, category, daily_rate, "
                "is_available, seats, engine_cc, image_url, description "
                "FROM vehicles ORDER BY id"
            );

            crow::json::wvalue::list vehicleList;

            for (const auto& row : rows)
            {
                crow::json::wvalue vehicle;

                vehicle["vehicle_code"] =
                    row["vehicle_code"].as<std::string>();

                vehicle["brand"] =
                    row["brand"].as<std::string>();

                vehicle["model"] =
                    row["model"].as<std::string>();

                vehicle["category"] =
                    row["category"].as<std::string>();

                vehicle["daily_rate"] =
                    row["daily_rate"].as<double>();

                vehicle["is_available"] =
                    row["is_available"].as<bool>();

                vehicle["seats"] = row["seats"].as<int>();

                if (!row["engine_cc"].is_null())
                {
                    vehicle["engine_cc"] = row["engine_cc"].as<int>();
                }

                vehicle["image_url"] = row["image_url"].is_null()
                    ? ""
                    : row["image_url"].as<std::string>();

                vehicle["description"] = row["description"].is_null()
                    ? ""
                    : row["description"].as<std::string>();

                vehicleList.push_back(std::move(vehicle));
            }

            crow::json::wvalue result;
            result["count"] =
                static_cast<int>(vehicleList.size());

            result["vehicles"] = std::move(vehicleList);

            return jsonResponse(200, result);
        }
        catch (const std::exception& error)
        {
            std::cerr << "Vehicle query failed: "
                      << error.what() << '\n';

            crow::json::wvalue result;
            result["error"] =
                "Unable to retrieve vehicle listings.";

            return jsonResponse(500, result);
        }
    });

    // Allow browser preflight requests for vehicle creation.
    CROW_ROUTE(app, "/api/vehicles")
        .methods(crow::HTTPMethod::OPTIONS)
    ([]
    {
        crow::response response(204);
        response.add_header(
            "Access-Control-Allow-Origin",
            "http://localhost:5500"
        );
        response.add_header(
            "Access-Control-Allow-Methods",
            "GET, POST, OPTIONS"
        );
        response.add_header(
            "Access-Control-Allow-Headers",
            "Content-Type"
        );
        return response;
    });

    // Create a vehicle and save it in PostgreSQL.
    CROW_ROUTE(app, "/api/vehicles")
        .methods(crow::HTTPMethod::POST)
    ([](const crow::request& req)
    {
        crow::json::wvalue result;

        try
        {
            auto body = crow::json::load(req.body);

            if (!body)
            {
                result["error"] = "Invalid JSON request.";
                return jsonResponse(400, result);
            }

            const std::string brand = body["brand"].s();
            const std::string model = body["model"].s();
            const std::string category = body["category"].s();
            const double dailyRate = body["daily_rate"].d();
            const int seats = body["seats"].i();
            const int engineCC = body["engine_cc"].i();
            const std::string imageURL = body["image_url"].s();
            const std::string description = body["description"].s();

            if (brand.empty() || model.empty() ||
                description.empty() || imageURL.empty())
            {
                result["error"] =
                    "Complete all fields and upload an image.";
                return jsonResponse(400, result);
            }

            if (brand.size() > 100 || model.size() > 100 ||
                description.size() > 2000)
            {
                result["error"] = "One or more fields are too long.";
                return jsonResponse(400, result);
            }

            if (category != "Car" && category != "Bike" &&
                category != "SUV" && category != "Van")
            {
                result["error"] = "Invalid vehicle category.";
                return jsonResponse(400, result);
            }

            if (dailyRate <= 0 || dailyRate > 10000000 ||
                seats < 1 || seats > 100 ||
                engineCC < 0 || engineCC > 10000)
            {
                result["error"] = "Invalid price or vehicle specifications.";
                return jsonResponse(400, result);
            }

            if (imageURL.rfind("/uploads/vehicles/", 0) != 0 ||
                imageURL.find("..") != std::string::npos)
            {
                result["error"] = "Invalid vehicle image path.";
                return jsonResponse(400, result);
            }

            const auto timestamp =
                std::chrono::duration_cast<std::chrono::milliseconds>(
                    std::chrono::system_clock::now().time_since_epoch()
                ).count();

            const std::string vehicleCode =
                "VR-" + std::to_string(timestamp);

            pqxx::connection connection(
                getDatabaseConnectionString()
            );

            pqxx::work transaction(connection);

            transaction.exec_params(
                "INSERT INTO vehicles "
                "(vehicle_code, brand, model, category, daily_rate, "
                "seats, engine_cc, image_url, description, is_available) "
                "VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, 0), "
                "$8, $9, TRUE)",
                vehicleCode,
                brand,
                model,
                category,
                dailyRate,
                seats,
                engineCC,
                imageURL,
                description
            );

            transaction.commit();

            result["message"] = "Vehicle created successfully.";
            result["vehicle_code"] = vehicleCode;

            return jsonResponse(201, result);
        }
        catch (const std::exception& error)
        {
            std::cerr << "Vehicle creation failed: "
                      << error.what() << '\n';

            result["error"] =
                "Could not create the vehicle. Check the submitted fields "
                "and database schema.";

            return jsonResponse(400, result);
        }
    });

    // Endpoint 3: serve uploaded vehicle images.
    CROW_ROUTE(app, "/uploads/vehicles/<string>")
    ([](const std::string& filename)
    {
        crow::response response;

        // Only allow safe filenames, not directory paths.
        if (filename.empty() || filename.find("..") != std::string::npos)
        {
            response.code = 400;
            response.body = "Invalid image filename";
            return response;
        }

        for (unsigned char character : filename)
        {
            if (!std::isalnum(character) &&
                character != '.' &&
                character != '_' &&
                character != '-')
            {
                response.code = 400;
                response.body = "Invalid image filename";
                return response;
            }
        }

        const std::filesystem::path imageDirectory =
            std::filesystem::path(__FILE__).parent_path()
            / "uploads" / "vehicles";

        const std::filesystem::path imagePath =
            imageDirectory / filename;

        std::ifstream imageFile(imagePath, std::ios::binary);

        if (!imageFile)
        {
            response.code = 404;
            response.body = "Image not found";
            return response;
        }

        response.body = std::string(
            std::istreambuf_iterator<char>(imageFile),
            std::istreambuf_iterator<char>()
        );

        const std::string extension = imagePath.extension().string();

        if (extension == ".jpg" || extension == ".jpeg")
        {
            response.set_header("Content-Type", "image/jpeg");
        }
        else if (extension == ".png")
        {
            response.set_header("Content-Type", "image/png");
        }
        else if (extension == ".webp")
        {
            response.set_header("Content-Type", "image/webp");
        }
        else
        {
            response.set_header("Content-Type", "application/octet-stream");
        }

        response.set_header("X-Content-Type-Options", "nosniff");
        return response;
    });
    

    // Endpoint 4: accept and save an uploaded vehicle image.
    CROW_ROUTE(app, "/api/upload-image")
        .methods(crow::HTTPMethod::POST)
    ([](const crow::request& req)
    {
        crow::json::wvalue result;

        try
        {
            // Limit uploads to 5 MB.
            constexpr std::size_t maxFileSize = 5 * 1024 * 1024;

            if (req.body.size() > maxFileSize + 64 * 1024)
            {
                result["error"] = "Upload is too large. Maximum image size is 5 MB.";
                return jsonResponse(413, result);
            }

            crow::multipart::message form(req);

            auto imagePart = form.get_part_by_name("image");

            if (imagePart.body.empty())
            {
                result["error"] = "No image was provided. Use the form field name 'image'.";
                return jsonResponse(400, result);
            }

            if (imagePart.body.size() > maxFileSize)
            {
                result["error"] = "Image must be 5 MB or smaller.";
                return jsonResponse(413, result);
            }

            // Read the browser-provided filename from Content-Disposition.
            const auto& disposition =
                imagePart.get_header_object("Content-Disposition");

            auto filenameIt = disposition.params.find("filename");

            if (filenameIt == disposition.params.end() ||
                filenameIt->second.empty())
            {
                result["error"] = "The uploaded file must have a filename.";
                return jsonResponse(400, result);
            }

            // Use the extension only to determine the accepted format.
            std::filesystem::path originalName(filenameIt->second);
            std::string extension = originalName.extension().string();

            for (char& ch : extension)
            {
                ch = static_cast<char>(
                    std::tolower(static_cast<unsigned char>(ch))
                );
            }

            std::string expectedType;

            if (extension == ".jpg" || extension == ".jpeg")
            {
                expectedType = "image/jpeg";
            }
            else if (extension == ".png")
            {
                expectedType = "image/png";
            }
            else if (extension == ".webp")
            {
                expectedType = "image/webp";
            }
            else
            {
                result["error"] = "Only JPEG, PNG, and WebP images are accepted.";
                return jsonResponse(400, result);
            }

            // Verify the file's actual signature, not just its extension.
            const std::string& bytes = imagePart.body;
            bool validImage = false;

            if (expectedType == "image/jpeg")
            {
                validImage =
                    bytes.size() >= 3 &&
                    static_cast<unsigned char>(bytes[0]) == 0xFF &&
                    static_cast<unsigned char>(bytes[1]) == 0xD8 &&
                    static_cast<unsigned char>(bytes[2]) == 0xFF;
            }
            else if (expectedType == "image/png")
            {
                const unsigned char signature[] = {
                    0x89, 0x50, 0x4E, 0x47,
                    0x0D, 0x0A, 0x1A, 0x0A
                };

                validImage = bytes.size() >= sizeof(signature);

                for (std::size_t i = 0;
                     validImage && i < sizeof(signature);
                     ++i)
                {
                    validImage =
                        static_cast<unsigned char>(bytes[i]) == signature[i];
                }
            }
            else if (expectedType == "image/webp")
            {
                validImage =
                    bytes.size() >= 12 &&
                    bytes.compare(0, 4, "RIFF") == 0 &&
                    bytes.compare(8, 4, "WEBP") == 0;
            }

            if (!validImage)
            {
                result["error"] = "The file contents do not match the image type.";
                return jsonResponse(400, result);
            }

            // Generate a unique server-controlled filename.
            const auto now =
                std::chrono::steady_clock::now().time_since_epoch().count();

            const std::string savedFilename =
                "vehicle_" + std::to_string(now) + extension;

            const std::filesystem::path uploadDirectory =
                std::filesystem::path(__FILE__).parent_path()
                / "uploads" / "vehicles";

            std::filesystem::create_directories(uploadDirectory);

            const std::filesystem::path destination =
                uploadDirectory / savedFilename;

            std::ofstream output(
                destination,
                std::ios::binary | std::ios::out
            );

            if (!output)
            {
                result["error"] = "The server could not save the image.";
                return jsonResponse(500, result);
            }

            output.write(
                bytes.data(),
                static_cast<std::streamsize>(bytes.size())
            );

            output.close();

            if (!output)
            {
                std::filesystem::remove(destination);
                result["error"] = "The image could not be saved completely.";
                return jsonResponse(500, result);
            }

            result["message"] = "Image uploaded successfully.";
            result["filename"] = savedFilename;
            result["image_url"] =
                "/uploads/vehicles/" + savedFilename;

            return jsonResponse(201, result);
        }
        catch (const std::exception& error)
        {
            std::cerr << "Image upload failed: "
                      << error.what() << '\n';

            result["error"] = "The upload could not be processed.";
            return jsonResponse(400, result);
        }
    });


    const int port = getPort();

    std::cout << "Vehicle Rental API starting on port "
              << port << '\n';

    app.bindaddr("0.0.0.0")
       .port(static_cast<std::uint16_t>(port))
       .multithreaded()
       .run();

    return 0;
}
