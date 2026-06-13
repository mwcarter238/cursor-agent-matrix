namespace PharmaInventory.Api.Gs1;

/// <summary>A single parsed Application Identifier element from a GS1 barcode.</summary>
public sealed class Gs1Element
{
    public required string Ai { get; init; }
    public required string Name { get; init; }
    public required string Value { get; init; }
}

/// <summary>
/// The structured result of parsing a GS1 barcode payload. Pharma-relevant
/// fields are promoted to first-class properties; everything parsed is also
/// available in <see cref="Elements"/>.
/// </summary>
public sealed class Gs1Barcode
{
    /// <summary>(01) Global Trade Item Number — 14 digits.</summary>
    public string? Gtin { get; set; }

    /// <summary>(10) Batch / lot number.</summary>
    public string? Lot { get; set; }

    /// <summary>(21) Serial number — present on serialised (DSCSA) packs.</summary>
    public string? Serial { get; set; }

    /// <summary>(17) Expiration date.</summary>
    public DateOnly? Expiry { get; set; }

    /// <summary>(11) Production date.</summary>
    public DateOnly? ProductionDate { get; set; }

    /// <summary>(00) SSCC — present on logistic units / cases.</summary>
    public string? Sscc { get; set; }

    /// <summary>(30) / (37) variable count.</summary>
    public int? Quantity { get; set; }

    /// <summary>National Healthcare Reimbursement Number (71x), e.g. German PZN.</summary>
    public string? Nhrn { get; set; }

    /// <summary>Every element that was decoded, in order.</summary>
    public List<Gs1Element> Elements { get; set; } = new();

    /// <summary>AIs that could not be interpreted (unknown / malformed).</summary>
    public List<string> Warnings { get; set; } = new();

    /// <summary>The raw payload as received from the scanner (GS chars normalised).</summary>
    public string Raw { get; set; } = string.Empty;
}
