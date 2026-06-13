namespace PharmaInventory.Api.Gs1;

/// <summary>
/// Parses GS1 element strings (GS1-128, GS1 DataMatrix, GS1 QR) into a
/// structured <see cref="Gs1Barcode"/>.
///
/// The parser walks the payload one element at a time. At each position it
/// detects the Application Identifier (trying the longest known AI first),
/// then consumes either a fixed number of characters or everything up to the
/// next FNC1 separator (encoded as the ASCII Group Separator, 0x1D) for
/// variable-length AIs.
/// </summary>
public static class Gs1Parser
{
    // The ASCII Group Separator that scanners emit in place of the FNC1
    // function character that terminates a variable-length element.
    private const char Gs = '';

    private static readonly int[] AiLengths = { 4, 3, 2 };

    // Curated AI table. Longest-prefix matching means 3- and 4-digit AIs are
    // tried before 2-digit ones, so there is no ambiguity at element starts.
    private static readonly Dictionary<string, ApplicationIdentifier> Table = new[]
    {
        new ApplicationIdentifier("00", "SSCC", Fixed: true, 18, Field: "sscc"),
        new ApplicationIdentifier("01", "GTIN", Fixed: true, 14, Field: "gtin"),
        new ApplicationIdentifier("02", "Content GTIN", Fixed: true, 14),
        new ApplicationIdentifier("10", "Batch/Lot", Fixed: false, 20, Field: "lot"),
        new ApplicationIdentifier("11", "Production date", Fixed: true, 6, IsDate: true, Field: "production"),
        new ApplicationIdentifier("13", "Packaging date", Fixed: true, 6, IsDate: true),
        new ApplicationIdentifier("15", "Best before", Fixed: true, 6, IsDate: true),
        new ApplicationIdentifier("16", "Sell by", Fixed: true, 6, IsDate: true),
        new ApplicationIdentifier("17", "Expiration date", Fixed: true, 6, IsDate: true, Field: "expiry"),
        new ApplicationIdentifier("20", "Variant", Fixed: true, 2),
        new ApplicationIdentifier("21", "Serial number", Fixed: false, 20, Field: "serial"),
        new ApplicationIdentifier("22", "Consumer product variant", Fixed: false, 20),
        new ApplicationIdentifier("30", "Variable count", Fixed: false, 8, Field: "quantity"),
        new ApplicationIdentifier("37", "Count of trade items", Fixed: false, 8, Field: "quantity"),
        new ApplicationIdentifier("240", "Additional product id", Fixed: false, 30),
        new ApplicationIdentifier("241", "Customer part number", Fixed: false, 30),
        new ApplicationIdentifier("710", "NHRN PZN", Fixed: false, 20, Field: "nhrn"),
        new ApplicationIdentifier("711", "NHRN CIP", Fixed: false, 20, Field: "nhrn"),
        new ApplicationIdentifier("712", "NHRN CN", Fixed: false, 20, Field: "nhrn"),
        new ApplicationIdentifier("713", "NHRN DRN", Fixed: false, 20, Field: "nhrn"),
        new ApplicationIdentifier("714", "NHRN AIM", Fixed: false, 20, Field: "nhrn"),
    }.ToDictionary(ai => ai.Ai);

    public static Gs1Barcode Parse(string? raw)
    {
        var result = new Gs1Barcode { Raw = raw ?? string.Empty };
        if (string.IsNullOrWhiteSpace(raw))
        {
            result.Warnings.Add("Empty barcode payload.");
            return result;
        }

        var data = Normalise(raw);
        result.Raw = data;

        int pos = 0;
        while (pos < data.Length)
        {
            // Skip stray separators.
            if (data[pos] == Gs)
            {
                pos++;
                continue;
            }

            var ai = MatchAi(data, pos);
            if (ai is null)
            {
                result.Warnings.Add($"Unknown AI at position {pos}: '{Snippet(data, pos)}'.");
                break;
            }

            pos += ai.Ai.Length;

            string value;
            if (ai.Fixed)
            {
                if (pos + ai.MaxLength > data.Length)
                {
                    result.Warnings.Add($"Truncated value for AI ({ai.Ai}) {ai.Name}.");
                    value = data[pos..];
                    pos = data.Length;
                }
                else
                {
                    value = data.Substring(pos, ai.MaxLength);
                    pos += ai.MaxLength;
                }
            }
            else
            {
                int end = data.IndexOf(Gs, pos);
                if (end < 0) end = data.Length;
                value = data[pos..end];
                pos = end < data.Length ? end + 1 : end; // consume the separator
            }

            Assign(result, ai, value);
        }

        return result;
    }

    /// <summary>
    /// Strips a leading symbology identifier (]C1, ]e0, ]d2, ]Q3, …) that some
    /// scanners prepend, and converts textual FNC1 placeholders to the ASCII GS.
    /// </summary>
    private static string Normalise(string raw)
    {
        var s = raw;

        // Symbology identifier prefix: a ']' followed by two characters.
        if (s.Length >= 3 && s[0] == ']')
            s = s[3..];

        // Textual stand-ins some tools/scanners emit for the FNC1/GS separator.
        s = s.Replace("<GS>", "")
             .Replace("{GS}", "");

        return s;
    }

    private static ApplicationIdentifier? MatchAi(string data, int pos)
    {
        foreach (var len in AiLengths)
        {
            if (pos + len > data.Length) continue;
            var candidate = data.Substring(pos, len);
            if (Table.TryGetValue(candidate, out var ai)) return ai;
        }
        return null;
    }

    private static void Assign(Gs1Barcode result, ApplicationIdentifier ai, string value)
    {
        result.Elements.Add(new Gs1Element { Ai = ai.Ai, Name = ai.Name, Value = value });

        switch (ai.Field)
        {
            case "gtin": result.Gtin = value; break;
            case "lot": result.Lot = value; break;
            case "serial": result.Serial = value; break;
            case "sscc": result.Sscc = value; break;
            case "nhrn": result.Nhrn = value; break;
            case "quantity":
                if (int.TryParse(value, out var qty)) result.Quantity = qty;
                break;
            case "expiry":
                result.Expiry = ParseDate(value, result);
                break;
            case "production":
                result.ProductionDate = ParseDate(value, result);
                break;
        }
    }

    /// <summary>
    /// Parses a GS1 YYMMDD date. A day component of "00" denotes the last day
    /// of the month. Two-digit years map into 2000–2099 (adequate for pharma
    /// expiry dating).
    /// </summary>
    private static DateOnly? ParseDate(string value, Gs1Barcode result)
    {
        if (value.Length != 6 || !value.All(char.IsDigit))
        {
            result.Warnings.Add($"Invalid date value '{value}'.");
            return null;
        }

        int year = 2000 + int.Parse(value[..2]);
        int month = int.Parse(value.Substring(2, 2));
        int day = int.Parse(value.Substring(4, 2));

        if (month is < 1 or > 12)
        {
            result.Warnings.Add($"Invalid month in date '{value}'.");
            return null;
        }

        if (day == 0)
            day = DateTime.DaysInMonth(year, month); // "00" => end of month
        else if (day > DateTime.DaysInMonth(year, month))
        {
            result.Warnings.Add($"Invalid day in date '{value}'.");
            return null;
        }

        return new DateOnly(year, month, day);
    }

    private static string Snippet(string data, int pos) =>
        data.Substring(pos, Math.Min(6, data.Length - pos));
}
