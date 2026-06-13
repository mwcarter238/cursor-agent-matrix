using System.ComponentModel.DataAnnotations;

namespace PharmaInventory.Api.Domain;

/// <summary>The kind of stock movement a transaction represents.</summary>
public enum TransactionType
{
    Receive = 1,
    Dispense = 2,
    CycleCount = 3,
}

/// <summary>An operator who signs in with a PIN. Actions are attributed to them.</summary>
public class AppUser
{
    public int Id { get; set; }

    [MaxLength(80)]
    public required string Name { get; set; }

    /// <summary>Short login code shown on the roster; not a secret on its own.</summary>
    [MaxLength(20)]
    public required string Username { get; set; }

    /// <summary>BCrypt hash of the operator's PIN.</summary>
    public required string PinHash { get; set; }

    public string Role { get; set; } = "operator";

    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>
/// A trade item identified by its GTIN. Catalogue-level data that is shared
/// across every lot of that product.
/// </summary>
public class Product
{
    public int Id { get; set; }

    /// <summary>(01) GTIN-14 — the natural key for a product.</summary>
    [MaxLength(14)]
    public required string Gtin { get; set; }

    [MaxLength(200)]
    public required string Name { get; set; }

    [MaxLength(80)]
    public string? Strength { get; set; }

    [MaxLength(80)]
    public string? Form { get; set; }

    [MaxLength(120)]
    public string? Manufacturer { get; set; }

    /// <summary>Quantity per pack, used to default receive/dispense amounts.</summary>
    public int? PackSize { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public List<InventoryLot> Lots { get; set; } = new();
}

/// <summary>
/// On-hand stock for a specific (GTIN, lot, expiry) combination. Quantity is
/// the running balance maintained by stock transactions.
/// </summary>
public class InventoryLot
{
    public int Id { get; set; }

    public int ProductId { get; set; }
    public Product? Product { get; set; }

    [MaxLength(20)]
    public string? Lot { get; set; }

    public DateOnly? Expiry { get; set; }

    /// <summary>Current on-hand units for this lot.</summary>
    public int Quantity { get; set; }

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>
/// An immutable audit record of a single stock movement. The ledger of these
/// rows is the source of truth; lot balances are a materialised projection.
/// </summary>
public class StockTransaction
{
    public int Id { get; set; }

    public TransactionType Type { get; set; }

    [MaxLength(14)]
    public required string Gtin { get; set; }

    [MaxLength(20)]
    public string? Lot { get; set; }

    [MaxLength(40)]
    public string? Serial { get; set; }

    public DateOnly? Expiry { get; set; }

    /// <summary>Signed change applied to on-hand stock (+receive, −dispense, ±count adjustment).</summary>
    public int QuantityDelta { get; set; }

    /// <summary>On-hand balance for the lot immediately after this transaction.</summary>
    public int ResultingQuantity { get; set; }

    public int UserId { get; set; }
    public AppUser? User { get; set; }

    /// <summary>The raw GS1 payload that produced this transaction, for traceability.</summary>
    [MaxLength(400)]
    public string? RawBarcode { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
