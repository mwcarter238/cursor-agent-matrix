using Microsoft.EntityFrameworkCore;
using PharmaInventory.Api.Domain;

namespace PharmaInventory.Api.Data;

/// <summary>
/// Ensures the schema exists and seeds a couple of demo operators plus a small
/// product catalogue so the app is usable immediately on first run.
/// </summary>
public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext db)
    {
        await db.Database.EnsureCreatedAsync();

        if (!await db.Users.AnyAsync())
        {
            db.Users.AddRange(
                new AppUser
                {
                    Name = "Demo Pharmacist",
                    Username = "demo",
                    Role = "pharmacist",
                    PinHash = BCrypt.Net.BCrypt.HashPassword("1234"),
                },
                new AppUser
                {
                    Name = "Demo Technician",
                    Username = "tech",
                    Role = "operator",
                    PinHash = BCrypt.Net.BCrypt.HashPassword("0000"),
                });
        }

        if (!await db.Products.AnyAsync())
        {
            db.Products.AddRange(
                new Product
                {
                    Gtin = "00312345678906",
                    Name = "Amoxicillin",
                    Strength = "500 mg",
                    Form = "Capsule",
                    Manufacturer = "Acme Pharma",
                    PackSize = 30,
                },
                new Product
                {
                    Gtin = "00312345678913",
                    Name = "Atorvastatin",
                    Strength = "20 mg",
                    Form = "Tablet",
                    Manufacturer = "Northwind Labs",
                    PackSize = 90,
                },
                new Product
                {
                    Gtin = "00312345678920",
                    Name = "Lisinopril",
                    Strength = "10 mg",
                    Form = "Tablet",
                    Manufacturer = "Contoso Health",
                    PackSize = 100,
                });
        }

        await db.SaveChangesAsync();
    }
}
