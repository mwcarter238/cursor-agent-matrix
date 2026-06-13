using PharmaInventory.Api.Gs1;
using Xunit;

namespace PharmaInventory.Tests;

public class Gs1ParserTests
{
    private const char Gs = '\u001d';

    [Fact]
    public void Parses_full_serialised_datamatrix()
    {
        // (01) GTIN, (17) expiry, (10) lot, (21) serial. Lot is variable length
        // and therefore terminated by a GS before the serial.
        var raw = $"0103064567890129172612311022A7B{Gs}21SN0001";

        var b = Gs1Parser.Parse(raw);

        Assert.Equal("03064567890129", b.Gtin);
        Assert.Equal(new DateOnly(2026, 12, 31), b.Expiry);
        Assert.Equal("22A7B", b.Lot);
        Assert.Equal("SN0001", b.Serial);
        Assert.Empty(b.Warnings);
    }

    [Fact]
    public void Handles_day_zero_as_end_of_month()
    {
        // 251100 => November 2025, day 00 means last day of month (30th).
        var b = Gs1Parser.Parse("0103064567890129" + "17251100");
        Assert.Equal(new DateOnly(2025, 11, 30), b.Expiry);
    }

    [Fact]
    public void Strips_symbology_identifier_prefix()
    {
        var b = Gs1Parser.Parse("]d20103064567890129");
        Assert.Equal("03064567890129", b.Gtin);
    }

    [Fact]
    public void Variable_lot_at_end_consumes_to_string_end()
    {
        var b = Gs1Parser.Parse("010306456789012910LOT-XYZ-9");
        Assert.Equal("03064567890129", b.Gtin);
        Assert.Equal("LOT-XYZ-9", b.Lot);
    }

    [Fact]
    public void Parses_lot_before_fixed_expiry_without_separator_when_fixed_follows()
    {
        // When a variable AI is followed by another element, a GS is required.
        var raw = $"0103064567890129" + "10ABC123" + Gs + "172612 31".Replace(" ", "");
        var b = Gs1Parser.Parse(raw);
        Assert.Equal("ABC123", b.Lot);
        Assert.Equal(new DateOnly(2026, 12, 31), b.Expiry);
    }

    [Fact]
    public void Reports_warning_for_unknown_ai()
    {
        var b = Gs1Parser.Parse("9912345");
        Assert.NotEmpty(b.Warnings);
    }

    [Fact]
    public void Empty_payload_is_safe()
    {
        var b = Gs1Parser.Parse("");
        Assert.Null(b.Gtin);
        Assert.NotEmpty(b.Warnings);
    }
}
