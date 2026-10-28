using Microsoft.EntityFrameworkCore;

namespace MulkYonetimi.Infrastructure;

public sealed class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : DbContext(options);
