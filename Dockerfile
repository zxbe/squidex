#
# Stage 1, Prebuild
#
FROM squidex/dotnet:2.1-sdk-chromium-phantomjs-node as builder

COPY src/Squidex/package.json /tmp/package.json

# Install Node packages 
RUN cd /tmp && npm install

COPY . .

WORKDIR /

# Build Frontend
RUN cp -a /tmp/node_modules /src/Squidex/ \
 && cd /src/Squidex \
 && npm run test:coverage \
 && npm run build:copy \
 && npm run build
 
# Test Backend
RUN dotnet restore \
 && dotnet test tests/Squidex.Infrastructure.Tests/Squidex.Infrastructure.Tests.csproj \ 
 && dotnet test tests/Squidex.Domain.Apps.Core.Tests/Squidex.Domain.Apps.Core.Tests.csproj \ 
 && dotnet test tests/Squidex.Domain.Apps.Entities.Tests/Squidex.Domain.Apps.Entities.Tests.csproj \
 && dotnet test tests/Squidex.Domain.Users.Tests/Squidex.Domain.Users.Tests.csproj \
 && dotnet test tests/Squidex.Tests/Squidex.Tests.csproj

# Publish
RUN dotnet publish src/Squidex/Squidex.csproj --output /out/alpine --configuration Release -r alpine.3.7-x64

#
# Stage 2, Build runtime
#
FROM microsoft/dotnet:2.1-runtime-deps-alpine

# Default AspNetCore directory
WORKDIR /app

# add libuv
RUN apk add --no-cache libuv \
&& ln -s /usr/lib/libuv.so.1 /usr/lib/libuv.so

# Copy from build stage
COPY --from=builder /out/alpine .

EXPOSE 80
EXPOSE 33333
EXPOSE 40000

ENTRYPOINT ["./Squidex"]