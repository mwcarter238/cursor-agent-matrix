using Microsoft.EntityFrameworkCore;
using PharmaInventory.Api.Data;
using PharmaInventory.Api.Domain;
using PharmaInventory.Api.Dtos;

namespace PharmaInventory.Api.Services;

/// <summary>
/// Core inventory logic shared by the three workflows. Every movement writes an
/// immutable <see cref="StockTransaction"/> and updates the matching lot balance
/// inside a single database transaction.
/// </summary>
public class InventoryService
{
    private readonly AppDbContext _db;

    public InventoryService(AppDbContext db) => _db = db;

    /// <summary>Receive stock: increase the lot balance by the scanned quantity.</summary>
    public Task<MovementResponse> ReceiveAsync(StockMovementRequest req, int userId) =>
        ApplyAsync(TransactionType.Receive, req, userId, delta: Math.Abs(req.Quantity));

    /// <summary>Dispense stock: decrease the lot balance by the scanned quantity.</summary>
    public Task<MovementResponse> DispenseAsync(StockMovementRequest req, int userId) =>
        ApplyAsync(TransactionType.Dispense, req, userId, delta: -Math.Abs(req.Quantity));

    /// <summary>
    /// Cycle count: set the lot's on-hand to the counted quantity. The recorded
    /// delta is the correction applied (counted − previous balance).
    /// </summary>
    public async Task<MovementResponse> CountAsync(StockMovementRequest req, int userId)
    {
        await using var tx = await _db.Database.BeginTransactionAsync();

        var product = await EnsureProductAsync(req);
        var lot = await EnsureLotAsync(product.Id, req.Lot, req.Expiry);

        int counted = Math.Abs(req.Quantity);
        int delta = counted - lot.Quantity;
        lot.Quantity = counted;
        lot.UpdatedAt = DateTimeOffset.UtcNow;

        var movement = Record(TransactionType.CycleCount, req, userId, delta, lot.Quantity);

        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        return new MovementResponse(movement.ToDto(product.Name), lot.Quantity);
    }

    private async Task<MovementResponse> ApplyAsync(
        TransactionType type, StockMovementRequest req, int userId, int delta)
    {
        await using var tx = await _db.Database.BeginTransactionAsync();

        var product = await EnsureProductAsync(req);
        var lot = await EnsureLotAsync(product.Id, req.Lot, req.Expiry);

        lot.Quantity = Math.Max(0, lot.Quantity + delta);
        lot.UpdatedAt = DateTimeOffset.UtcNow;

        var movement = Record(type, req, userId, delta, lot.Quantity);

        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        return new MovementResponse(movement.ToDto(product.Name), lot.Quantity);
    }

    private StockTransaction Record(
        TransactionType type, StockMovementRequest req, int userId, int delta, int resulting)
    {
        var movement = new StockTransaction
        {
            Type = type,
            Gtin = req.Gtin,
            Lot = req.Lot,
            Serial = req.Serial,
            Expiry = req.Expiry,
            QuantityDelta = delta,
            ResultingQuantity = resulting,
            UserId = userId,
            RawBarcode = req.RawBarcode,
        };
        _db.Transactions.Add(movement);
        return movement;
    }

    /// <summary>Find the product for a GTIN, creating a stub catalogue entry if new.</summary>
    public async Task<Product> EnsureProductAsync(StockMovementRequest req)
    {
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Gtin == req.Gtin);
        if (product is not null) return product;

        product = new Product
        {
            Gtin = req.Gtin,
            Name = string.IsNullOrWhiteSpace(req.Name) ? $"Unknown ({req.Gtin})" : req.Name!,
            Strength = req.Strength,
            Form = req.Form,
            Manufacturer = req.Manufacturer,
        };
        _db.Products.Add(product);
        await _db.SaveChangesAsync();
        return product;
    }

    private async Task<InventoryLot> EnsureLotAsync(int productId, string? lot, DateOnly? expiry)
    {
        var row = await _db.Lots.FirstOrDefaultAsync(l =>
            l.ProductId == productId && l.Lot == lot && l.Expiry == expiry);

        if (row is null)
        {
            row = new InventoryLot { ProductId = productId, Lot = lot, Expiry = expiry, Quantity = 0 };
            _db.Lots.Add(row);
        }
        return row;
    }

    /// <summary>On-hand total across all lots of a GTIN.</summary>
    public async Task<int> OnHandAsync(string gtin)
    {
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Gtin == gtin);
        if (product is null) return 0;
        return await _db.Lots.Where(l => l.ProductId == product.Id).SumAsync(l => l.Quantity);
    }

    public async Task<IReadOnlyList<InventoryRowDto>> InventoryAsync()
    {
        var products = await _db.Products
            .Include(p => p.Lots)
            .OrderBy(p => p.Name)
            .ToListAsync();

        return products.Select(p => new InventoryRowDto(
            p.ToDto(),
            p.Lots
                .OrderBy(l => l.Expiry ?? DateOnly.MaxValue)
                .Select(l => new LotDto(l.Id, l.Lot, l.Expiry, l.Quantity,
                    DateOnly.FromDateTime(l.UpdatedAt.UtcDateTime)))
                .ToList(),
            p.Lots.Sum(l => l.Quantity)))
            .ToList();
    }

    public async Task<IReadOnlyList<TransactionDto>> RecentTransactionsAsync(int take = 50)
    {
        var rows = await _db.Transactions
            .Include(t => t.User)
            .OrderByDescending(t => t.Id)
            .Take(take)
            .ToListAsync();

        var names = await _db.Products
            .Where(p => rows.Select(r => r.Gtin).Contains(p.Gtin))
            .ToDictionaryAsync(p => p.Gtin, p => p.Name);

        return rows.Select(t => t.ToDto(names.GetValueOrDefault(t.Gtin))).ToList();
    }
}
