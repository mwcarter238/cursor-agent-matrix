using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using PharmaInventory.Api.Data;
using PharmaInventory.Api.Dtos;
using PharmaInventory.Api.Gs1;
using PharmaInventory.Api.Services;

namespace PharmaInventory.Api.Endpoints;

public static class ApiEndpoints
{
    public static void MapApi(this WebApplication app)
    {
        var api = app.MapGroup("/api");

        MapAuth(api);
        MapScan(api);
        MapWorkflows(api);
        MapInventory(api);
    }

    private static void MapAuth(RouteGroupBuilder api)
    {
        var auth = api.MapGroup("/auth");

        auth.MapGet("/operators", async (AppDbContext db) =>
            Results.Ok(await db.Users
                .Where(u => u.IsActive)
                .OrderBy(u => u.Name)
                .Select(u => new UserDto(u.Id, u.Name, u.Username, u.Role))
                .ToListAsync()));

        auth.MapPost("/login", async (LoginRequest req, AppDbContext db, TokenService tokens) =>
        {
            var user = await db.Users.FirstOrDefaultAsync(u =>
                u.Username == req.Username && u.IsActive);

            if (user is null || !BCrypt.Net.BCrypt.Verify(req.Pin, user.PinHash))
                return Results.Unauthorized();

            return Results.Ok(new LoginResponse(tokens.CreateToken(user), user.ToDto()));
        });

        auth.MapGet("/me", (ClaimsPrincipal user) =>
            Results.Ok(new { name = user.Identity?.Name, role = user.FindFirstValue(ClaimTypes.Role) }))
            .RequireAuthorization();
    }

    private static void MapScan(RouteGroupBuilder api)
    {
        // Parse a raw GS1 payload and enrich it with catalogue + on-hand info.
        api.MapPost("/scan/parse", async (ParseRequest req, AppDbContext db, InventoryService inv) =>
        {
            var barcode = Gs1Parser.Parse(req.Raw);

            ProductDto? product = null;
            int onHand = 0;
            if (!string.IsNullOrEmpty(barcode.Gtin))
            {
                var p = await db.Products.FirstOrDefaultAsync(x => x.Gtin == barcode.Gtin);
                if (p is not null)
                {
                    product = p.ToDto();
                    onHand = await inv.OnHandAsync(barcode.Gtin);
                }
            }

            return Results.Ok(new ScanResult(barcode, product, onHand));
        }).RequireAuthorization();
    }

    private static void MapWorkflows(RouteGroupBuilder api)
    {
        var wf = api.MapGroup("/").RequireAuthorization();

        wf.MapPost("/receive", (StockMovementRequest req, InventoryService inv, ClaimsPrincipal u) =>
            Handle(req, () => inv.ReceiveAsync(req, UserId(u))));

        wf.MapPost("/dispense", (StockMovementRequest req, InventoryService inv, ClaimsPrincipal u) =>
            Handle(req, () => inv.DispenseAsync(req, UserId(u))));

        wf.MapPost("/cycle-count", (StockMovementRequest req, InventoryService inv, ClaimsPrincipal u) =>
            Handle(req, () => inv.CountAsync(req, UserId(u))));
    }

    private static void MapInventory(RouteGroupBuilder api)
    {
        var inventory = api.MapGroup("/inventory").RequireAuthorization();

        inventory.MapGet("/", async (InventoryService inv) =>
            Results.Ok(await inv.InventoryAsync()));

        inventory.MapGet("/transactions", async (InventoryService inv, int? take) =>
            Results.Ok(await inv.RecentTransactionsAsync(take ?? 50)));

        api.MapGet("/products/{gtin}", async (string gtin, AppDbContext db, InventoryService inv) =>
        {
            var p = await db.Products.FirstOrDefaultAsync(x => x.Gtin == gtin);
            return p is null
                ? Results.NotFound()
                : Results.Ok(new { product = p.ToDto(), onHand = await inv.OnHandAsync(gtin) });
        }).RequireAuthorization();
    }

    private static async Task<IResult> Handle(
        StockMovementRequest req, Func<Task<MovementResponse>> action)
    {
        if (string.IsNullOrWhiteSpace(req.Gtin))
            return Results.BadRequest(new { error = "A GTIN is required." });
        if (req.Quantity == 0)
            return Results.BadRequest(new { error = "Quantity must be non-zero." });

        return Results.Ok(await action());
    }

    private static int UserId(ClaimsPrincipal user) =>
        int.TryParse(user.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)
            ?? user.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
            ? id
            : throw new InvalidOperationException("Authenticated user has no subject claim.");
}
