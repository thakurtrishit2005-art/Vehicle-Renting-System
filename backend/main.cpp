
#include <crow.h>
#include <crow/multipart.h>
#include <pqxx/pqxx>

#include <algorithm>
#include <cctype>
#include <chrono>
#include <cstdint>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
#include <string>

std::string getDatabaseConnectionString()
{
    const char* value = std::getenv("DATABASE_URL");

    if (value && value[0] != '\0')
        return value;

    return "dbname=vehicle_rental";
}

int getPort()
{
    const char* value = std::getenv("PORT");

    if (value && value[0] != '\0')
    {
        try
        {
            const int port = std::stoi(value);
            if (port >= 1 && port <= 65535)
                return port;
        }
        catch (...)
        {
        }
    }

    return 18080;
}

std::string getAllowedOrigin()
{
    const char* value = std::getenv("FRONTEND_ORIGIN");

    if (value && value[0] != '\0')
        return value;

    return "http://localhost:5500";
}

void addCorsHeaders(crow::response& response)
{
    response.add_header(
        "Access-Control-Allow-Origin", getAllowedOrigin());

    response.add_header(
        "Access-Control-Allow-Methods", "GET, POST, OPTIONS");

    response.add_header(
        "Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");

    response.add_header("Vary", "Origin");
    response.add_header("X-Content-Type-Options", "nosniff");
}

// Apply CORS headers to every response, including preflight requests.
struct CorsMiddleware
{
    struct context {};

    void before_handle(
        crow::request& req,
        crow::response& res,
        context&)
    {
        if (req.method == crow::HTTPMethod::OPTIONS)
        {
            res.code = 204;
            addCorsHeaders(res);
            res.end();
        }
    }

    void after_handle(
        crow::request&,
        crow::response& res,
        context&)
    {
        addCorsHeaders(res);
    }
};

crow::response jsonResponse(
    int status, const crow::json::wvalue& data)
{
    crow::response response(status);
    response.add_header("Content-Type", "application/json");
    addCorsHeaders(response);
    response.body = data.dump();
    return response;
}

bool isAuthorizedAdmin(const crow::request& req)
{
    const char* expected = std::getenv("ADMIN_API_KEY");

    if (!expected || expected[0] == '\0')
        return false;

    const std::string supplied =
        req.get_header_value("X-Admin-Key");

    return !supplied.empty() && supplied == expected;
}

std::filesystem::path getUploadDirectory()
{
    const char* value = std::getenv("UPLOAD_DIR");

    if (value && value[0] != '\0')
        return std::filesystem::path(value);

    return std::filesystem::path(__FILE__).parent_path()
        / "uploads" / "vehicles";
}

bool hasStringField(
    const crow::json::rvalue& body,
    const char* name)
{
    return body.has(name) &&
        body[name].t() == crow::json::type::String;
}

int main()
{
    crow::App<CorsMiddleware> app;

    // Health check
    CROW_ROUTE(app, "/api/health")
    ([]
    {
        crow::json::wvalue result;

        try
        {
            pqxx::connection connection(
                getDatabaseConnectionString());

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

    // Retrieve vehicles
    CROW_ROUTE(app, "/api/vehicles")
    ([]
    {
        try
        {
            pqxx::connection connection(
                getDatabaseConnectionString());

            pqxx::read_transaction transaction(connection);

            const auto rows = transaction.exec(
                "SELECT vehicle_code, brand, model, category, daily_rate, "
                "is_available, seats, engine_cc, image_url, description "
                "FROM vehicles ORDER BY id");

            crow::json::wvalue::list vehicles;

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

                vehicle["seats"] =
                    row["seats"].as<int>();

                vehicle["engine_cc"] = row["engine_cc"].is_null()
                    ? 0 : row["engine_cc"].as<int>();

                vehicle["image_url"] = row["image_url"].is_null()
                    ? "" : row["image_url"].as<std::string>();

                vehicle["description"] = row["description"].is_null()
                    ? "" : row["description"].as<std::string>();

                vehicles.push_back(std::move(vehicle));
            }

            crow::json::wvalue result;
            result["count"] = static_cast<int>(vehicles.size());
            result["vehicles"] = std::move(vehicles);

            return jsonResponse(200, result);
        }
        catch (const std::exception& error)
        {
            std::cerr << "Vehicle query failed: "
                      << error.what() << '\n';

            crow::json::wvalue result;
            result["error"] = "Unable to retrieve vehicle listings.";

            return jsonResponse(500, result);
        }
    });

    // Create vehicle
    CROW_ROUTE(app, "/api/vehicles")
        .methods(crow::HTTPMethod::POST)
    ([](const crow::request& req)
    {
        crow::json::wvalue result;

        if (!isAuthorizedAdmin(req))
        {
            result["error"] = "Unauthorized.";
            return jsonResponse(401, result);
        }

        try
        {
            const auto body = crow::json::load(req.body);

            if (!body ||
                !hasStringField(body, "brand") ||
                !hasStringField(body, "model") ||
                !hasStringField(body, "category") ||
                !hasStringField(body, "image_url") ||
                !hasStringField(body, "description") ||
                !body.has("daily_rate") ||
                !body.has("seats") ||
                !body.has("engine_cc"))
            {
                result["error"] = "Invalid or incomplete JSON fields.";
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
                description.empty() || imageURL.empty() ||
                brand.size() > 100 || model.size() > 100 ||
                description.size() > 2000)
            {
                result["error"] = "Invalid field values or lengths.";
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
                result["error"] = "Invalid vehicle specifications.";
                return jsonResponse(400, result);
            }

            if (imageURL.rfind("/uploads/vehicles/", 0) != 0 ||
                imageURL.find("..") != std::string::npos)
            {
                result["error"] = "Invalid image path.";
                return jsonResponse(400, result);
            }

            const std::string vehicleCode =
                "VR-" + std::to_string(
                    std::chrono::duration_cast<
                        std::chrono::milliseconds>(
                        std::chrono::system_clock::now()
                            .time_since_epoch()).count());

            pqxx::connection connection(
                getDatabaseConnectionString());

            pqxx::work transaction(connection);

            transaction.exec_params(
                "INSERT INTO vehicles "
                "(vehicle_code, brand, model, category, daily_rate, "
                "seats, engine_cc, image_url, description, is_available) "
                "VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, 0), "
                "$8, $9, TRUE)",
                vehicleCode, brand, model, category, dailyRate,
                seats, engineCC, imageURL, description);

            transaction.commit();

            result["message"] = "Vehicle created successfully.";
            result["vehicle_code"] = vehicleCode;

            return jsonResponse(201, result);
        }
        catch (const std::exception& error)
        {
            std::cerr << "Vehicle creation failed: "
                      << error.what() << '\n';

            result["error"] = "Could not create vehicle.";

            return jsonResponse(400, result);
        }
    });

    // Upload image
    CROW_ROUTE(app, "/api/upload-image")
        .methods(crow::HTTPMethod::POST)
    ([](const crow::request& req)
    {
        crow::json::wvalue result;

        if (!isAuthorizedAdmin(req))
        {
            result["error"] = "Unauthorized.";
            return jsonResponse(401, result);
        }

        try
        {
            constexpr std::size_t maxImageSize = 5 * 1024 * 1024;

            if (req.body.size() > maxImageSize + 64 * 1024)
            {
                result["error"] =
                    "Request too large; image limit is 5 MB.";

                return jsonResponse(413, result);
            }

            crow::multipart::message form(req);
            const auto imagePart = form.get_part_by_name("image");

            if (imagePart.body.empty() ||
                imagePart.body.size() > maxImageSize)
            {
                result["error"] =
                    "Missing image or image exceeds 5 MB.";

                return jsonResponse(413, result);
            }

            const auto& disposition =
                imagePart.get_header_object("Content-Disposition");

            const auto it = disposition.params.find("filename");

            if (it == disposition.params.end() || it->second.empty())
            {
                result["error"] =
                    "Uploaded file must have a filename.";

                return jsonResponse(400, result);
            }

            std::string extension =
                std::filesystem::path(it->second).extension().string();

            std::transform(
                extension.begin(), extension.end(), extension.begin(),
                [](unsigned char c)
                {
                    return static_cast<char>(std::tolower(c));
                });

            const std::string& bytes = imagePart.body;
            bool valid = false;

            if (extension == ".jpg" || extension == ".jpeg")
            {
                valid = bytes.size() >= 3 &&
                    static_cast<unsigned char>(bytes[0]) == 0xFF &&
                    static_cast<unsigned char>(bytes[1]) == 0xD8 &&
                    static_cast<unsigned char>(bytes[2]) == 0xFF;
            }
            else if (extension == ".png")
            {
                const unsigned char signature[] = {
                    0x89, 0x50, 0x4E, 0x47,
                    0x0D, 0x0A, 0x1A, 0x0A
                };

                valid = bytes.size() >= sizeof(signature);

                for (std::size_t i = 0;
                     valid && i < sizeof(signature); ++i)
                {
                    valid =
                        static_cast<unsigned char>(bytes[i]) == signature[i];
                }
            }
            else if (extension == ".webp")
            {
                valid = bytes.size() >= 12 &&
                    bytes.compare(0, 4, "RIFF") == 0 &&
                    bytes.compare(8, 4, "WEBP") == 0;
            }
            else
            {
                result["error"] =
                    "Only JPEG, PNG, and WebP are accepted.";

                return jsonResponse(400, result);
            }

            if (!valid)
            {
                result["error"] =
                    "Image contents do not match file type.";

                return jsonResponse(400, result);
            }

            const auto now =
                std::chrono::steady_clock::now()
                    .time_since_epoch().count();

            const std::string filename =
                "vehicle_" + std::to_string(now) + extension;

            const auto directory = getUploadDirectory();
            std::filesystem::create_directories(directory);

            const auto destination = directory / filename;

            std::ofstream output(
                destination, std::ios::binary | std::ios::out);

            if (!output)
            {
                result["error"] = "Could not save image.";
                return jsonResponse(500, result);
            }

            output.write(
                bytes.data(),
                static_cast<std::streamsize>(bytes.size()));

            output.close();

            if (!output)
            {
                std::filesystem::remove(destination);

                result["error"] =
                    "Image was not saved completely.";

                return jsonResponse(500, result);
            }

            result["message"] = "Image uploaded successfully.";
            result["filename"] = filename;
            result["image_url"] = "/uploads/vehicles/" + filename;

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

    // Serve uploaded images
    CROW_ROUTE(app, "/uploads/vehicles/<string>")
    ([](const std::string& filename)
    {
        crow::response response;

        if (filename.empty() || filename.find("..") != std::string::npos)
        {
            response.code = 400;
            response.body = "Invalid image filename";
            return response;
        }

        for (unsigned char ch : filename)
        {
            if (!std::isalnum(ch) && ch != '.' &&
                ch != '_' && ch != '-')
            {
                response.code = 400;
                response.body = "Invalid image filename";
                return response;
            }
        }

        const std::filesystem::path path =
            getUploadDirectory() / filename;

        std::ifstream file(path, std::ios::binary);

        if (!file)
        {
            response.code = 404;
            response.body = "Image not found";
            return response;
        }

        response.body = std::string(
            std::istreambuf_iterator<char>(file),
            std::istreambuf_iterator<char>());

        const std::string ext = path.extension().string();

        if (ext == ".jpg" || ext == ".jpeg")
            response.set_header("Content-Type", "image/jpeg");
        else if (ext == ".png")
            response.set_header("Content-Type", "image/png");
        else if (ext == ".webp")
            response.set_header("Content-Type", "image/webp");
        else
        {
            response.code = 415;
            response.body = "Unsupported image type";
        }

        return response;
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
