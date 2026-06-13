using PharmaInventory.Api.Domain;
using PharmaInventory.Api.Gs1;

namespace PharmaInventory.Api.Dtos;

// ---- Auth ----
public record LoginRequest(string Username, string Pin);
public record LoginResponse(string Token, UserDto User);
public record UserDto(int Id, string Name, string Username, string Role);

// ---- Scanning ----
public record ParseRequest(string Raw);

/// <summary>Parsed barcode plus the matched product (if the GTIN is known).</summary>
public record ScanResult(Gs1Barcode Barcode, ProductDto? Product, int OnHand);

// ---- Catalogue / inventory ----
public record ProductDto(
    int Id, string Gtin, string Name, string? Strength, string? Form,
    string? Manufacturer, int? PackSize);

public record LotDto(int Id, string? Lot, DateOnly? Expiry, int Quantity, DateOnly? UpdatedAt);

public record InventoryRowDto(ProductDto Product, IReadOnlyList<LotDto> Lots, int TotalOnHand);

public record TransactionDto(
    int Id, string Type, string Gtin, string? ProductName, string? Lot,
    string? Serial, DateOnly? Expiry, int QuantityDelta, int ResultingQuantity,
    string UserName, DateTimeOffset CreatedAt);

// ---- Workflow commands ----
/// <summary>Common shape for a single scanned line in any of the three workflows.</summary>
public record StockMovementRequest(
    string Gtin,
    string? Lot,
    string? Serial,
    DateOnly? Expiry,
    int Quantity,
    string? RawBarcode,
    // Catalogue fields, used to auto-create a product the first time a GTIN is seen.
    string? Name = null,
    string? Strength = null,
    string? Form = null,
    string? Manufacturer = null);

public record MovementResponse(TransactionDto Transaction, int OnHand);

public static class Mapping
{
    public static ProductDto ToDto(this Product p) =>
        new(p.Id, p.Gtin, p.Name, p.Strength, p.Form, p.Manufacturer, p.PackSize);

    public static UserDto ToDto(this AppUser u) =>
        new(u.Id, u.Name, u.Username, u.Role);

    public static TransactionDto ToDto(this StockTransaction t, string? productName) =>
        new(t.Id, t.Type.ToString(), t.Gtin, productName, t.Lot, t.Serial, t.Expiry,
            t.QuantityDelta, t.ResultingQuantity, t.User?.Name ?? "—", t.CreatedAt);
}
