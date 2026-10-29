
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    libasio-dev \
    libpqxx-dev \
    libpq-dev \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

    RUN dpkg-query -W libpqxx-dev libpqxx-7.10 libpqxx-6.4 2>/dev/null || true \
    && dpkg -L libpqxx-dev | grep -E 'pqxx/(pqxx|version.hxx)|libpqxx\.so' \
    && ldconfig -p | grep libpqxx
    
# Build and install Crow for Linux
RUN git clone --depth 1 https://github.com/CrowCpp/Crow.git /tmp/Crow \
    && cmake -S /tmp/Crow -B /tmp/Crow/build \
       -DCMAKE_BUILD_TYPE=Release \
       -DCROW_BUILD_EXAMPLES=OFF \
       -DCROW_BUILD_TESTS=OFF \
       -DCMAKE_INSTALL_PREFIX=/usr/local \
    && cmake --build /tmp/Crow/build -j2 \
    && cmake --install /tmp/Crow/build \
    && rm -rf /tmp/Crow

WORKDIR /app

COPY backend/ ./backend/

RUN cmake -S backend -B backend/build -DCMAKE_BUILD_TYPE=Release \
    && cmake --build backend/build -j2

EXPOSE 10000

CMD ["sh", "-c", "./backend/build/vehicle_rental_api"]
