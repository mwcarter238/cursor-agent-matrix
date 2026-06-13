using Microsoft.EntityFrameworkCore;
using PharmaInventory.Api.Domain;

namespace PharmaInventory.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<InventoryLot> Lots => Set<InventoryLot>();
    public DbSet<StockTransaction> Transactions => Set<StockTransaction>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<AppUser>(e =>
        {
            e.HasIndex(u => u.Username).IsUnique();
        });

        b.Entity<Product>(e =>
        {
            e.HasIndex(p => p.Gtin).IsUnique();
        });

        b.Entity<InventoryLot>(e =>
        {
            // One balance row per product + lot + expiry combination.
            e.HasIndex(l => new { l.ProductId, l.Lot, l.Expiry }).IsUnique();
            e.HasOne(l => l.Product)
             .WithMany(p => p.Lots)
             .HasForeignKey(l => l.ProductId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<StockTransaction>(e =>
        {
            e.HasIndex(t => t.Gtin);
            e.HasIndex(t => t.CreatedAt);
            e.HasOne(t => t.User)
             .WithMany()
             .HasForeignKey(t => t.UserId)
             .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
