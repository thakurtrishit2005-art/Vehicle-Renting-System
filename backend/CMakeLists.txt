cmake_minimum_required(VERSION 3.20)

project(VehicleRentalBackend LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(Crow CONFIG REQUIRED)
find_package(PostgreSQL REQUIRED)

find_path(PQXX_INCLUDE_DIR
    NAMES pqxx/pqxx
    REQUIRED
)

find_library(PQXX_LIBRARY
    NAMES pqxx
    REQUIRED
)

message(STATUS "libpqxx headers: ${PQXX_INCLUDE_DIR}")
message(STATUS "libpqxx library: ${PQXX_LIBRARY}")

add_executable(vehicle_rental_api main.cpp)

target_include_directories(
    vehicle_rental_api
    PRIVATE
    ${PQXX_INCLUDE_DIR}
)

target_link_libraries(
    vehicle_rental_api
    PRIVATE
    Crow::Crow
    ${PQXX_LIBRARY}
    PostgreSQL::PostgreSQL
)
