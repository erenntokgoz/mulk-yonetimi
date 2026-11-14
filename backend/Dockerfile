# Production image for MulkYonetimi.Api. Build context: backend/
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Directory.Build.props .editorconfig ./
COPY src/MulkYonetimi.Infrastructure/*.csproj src/MulkYonetimi.Infrastructure/packages.lock.json src/MulkYonetimi.Infrastructure/
COPY src/MulkYonetimi.Api/*.csproj src/MulkYonetimi.Api/packages.lock.json src/MulkYonetimi.Api/
RUN dotnet restore src/MulkYonetimi.Api/MulkYonetimi.Api.csproj --locked-mode
COPY src/ src/
RUN dotnet publish src/MulkYonetimi.Api/MulkYonetimi.Api.csproj -c Release --no-restore -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_gcServer=0 \
    Auth__DataProtectionKeysPath=/keys
RUN mkdir -p /keys && chown $APP_UID /keys
COPY --from=build /app .
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "MulkYonetimi.Api.dll"]
