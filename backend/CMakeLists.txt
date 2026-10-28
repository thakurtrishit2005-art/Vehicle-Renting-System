
cmake_minimum_required(VERSION 3.20)

project(VehicleRentalBackend LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(Crow CONFIG REQUIRED)
find_package(PostgreSQL REQUIRED)

find_library(PQXX_LIBRARY NAMES pqxx REQUIRED)

add_executable(vehicle_rental_api main.cpp)

target_link_libraries(
    vehicle_rental_api
    PRIVATE
    Crow::Crow
    ${PQXX_LIBRARY}
    PostgreSQL::PostgreSQL
)
