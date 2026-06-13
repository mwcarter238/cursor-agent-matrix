namespace PharmaInventory.Api.Gs1;

/// <summary>
/// Definition of a GS1 Application Identifier (AI). Drives how the raw barcode
/// payload is segmented into structured fields.
/// </summary>
/// <param name="Ai">The AI code itself, e.g. "01" for GTIN.</param>
/// <param name="Name">Human readable name.</param>
/// <param name="Fixed">True when the data portion has a fixed length (no FNC1 terminator needed).</param>
/// <param name="MaxLength">Data length for fixed AIs, or the maximum length for variable AIs.</param>
/// <param name="IsDate">True when the data is a YYMMDD date.</param>
/// <param name="Field">Normalised field name this AI maps onto, or null if not surfaced.</param>
public sealed record ApplicationIdentifier(
    string Ai,
    string Name,
    bool Fixed,
    int MaxLength,
    bool IsDate = false,
    string? Field = null);
