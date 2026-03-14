import { Router, type IRouter, type Response } from "express";
import { db, groupsTable, groupMembersTable, usersTable, groupRestaurantsTable, votesTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { type AuthRequest, authMiddleware } from "../middlewares/auth.js";
import * as crypto from "crypto";

const router: IRouter = Router();

function generateId(): string {
  return crypto.randomBytes(16).toString("hex");
}

async function buildGroupResponse(groupId: string) {
  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group) return null;

  const members = await db
    .select({ member: groupMembersTable, user: usersTable })
    .from(groupMembersTable)
    .leftJoin(usersTable, eq(groupMembersTable.userId, usersTable.id))
    .where(eq(groupMembersTable.groupId, groupId));

  const restaurantCount = await db
    .select()
    .from(groupRestaurantsTable)
    .where(eq(groupRestaurantsTable.groupId, groupId));

  return {
    id: group.id,
    name: group.name,
    creatorId: group.creatorId,
    venueType: group.venueType,
    status: group.status,
    restaurantCount: restaurantCount.length,
    createdAt: group.createdAt.toISOString(),
    members: members.map(m => ({
      userId: m.member.userId,
      name: m.user?.name ?? "Unknown",
      avatar: m.user?.avatar ?? null,
      status: m.member.status,
      doneAt: m.member.doneAt?.toISOString() ?? null,
    })),
  };
}

router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, memberIds, venueType } = req.body as {
      name: string;
      memberIds: string[];
      venueType: string;
    };

    const groupId = generateId();
    await db.insert(groupsTable).values({
      id: groupId,
      name,
      creatorId: req.userId!,
      venueType,
      status: "pending",
    });

    const allMemberIds = [req.userId!, ...memberIds.filter(id => id !== req.userId)];
    await db.insert(groupMembersTable).values(
      allMemberIds.map(userId => ({
        id: generateId(),
        groupId,
        userId,
        status: userId === req.userId ? "joined" : "invited",
        joinedAt: userId === req.userId ? new Date() : null,
      }))
    );

    const group = await buildGroupResponse(groupId);
    res.status(201).json(group);
  } catch (err) {
    console.error("Create group error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const memberships = await db
      .select()
      .from(groupMembersTable)
      .where(eq(groupMembersTable.userId, req.userId!));

    const groupIds = memberships.map(m => m.groupId);
    if (groupIds.length === 0) {
      res.json([]);
      return;
    }

    const groups = await Promise.all(groupIds.map(id => buildGroupResponse(id)));
    res.json(groups.filter(Boolean));
  } catch (err) {
    console.error("Get groups error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

router.get("/:groupId", authMiddleware, async (req: AuthRequest, res: Response) => {
  const group = await buildGroupResponse(req.params.groupId);
  if (!group) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(group);
});

router.post("/:groupId/join", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await db
      .update(groupMembersTable)
      .set({ status: "joined", joinedAt: new Date() })
      .where(
        and(
          eq(groupMembersTable.groupId, req.params.groupId),
          eq(groupMembersTable.userId, req.userId!)
        )
      );

    const group = await buildGroupResponse(req.params.groupId);
    res.json(group);
  } catch (err) {
    console.error("Join group error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

router.post("/:groupId/start", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { lat, lng, radius, locationName } = req.body as {
      lat: number;
      lng: number;
      radius: number;
      locationName?: string;
    };

    const [existingGroup] = await db.select().from(groupsTable).where(eq(groupsTable.id, req.params.groupId)).limit(1);
    const venueType = existingGroup?.venueType ?? "restaurant";

    await db
      .update(groupsTable)
      .set({ lat, lng, radius, locationName: locationName ?? null, status: "swiping", updatedAt: new Date() })
      .where(eq(groupsTable.id, req.params.groupId));

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    const restaurants = await fetchRestaurants(lat, lng, radius, venueType, apiKey);

    if (restaurants.length > 0) {
      await db.insert(groupRestaurantsTable).values(
        restaurants.map(r => ({
          id: generateId(),
          groupId: req.params.groupId,
          placeId: r.placeId,
          name: r.name,
          address: r.address,
          rating: r.rating ?? null,
          reviewCount: r.reviewCount ?? null,
          priceLevel: r.priceLevel ?? null,
          photos: r.photos ?? [],
          cuisine: r.cuisine ?? null,
          openNow: r.openNow ?? null,
          distance: r.distance ?? null,
          lat: r.lat ?? null,
          lng: r.lng ?? null,
          mapsUrl: r.mapsUrl ?? null,
          menuItems: r.menuItems ?? [],
          reviews: r.reviews ?? [],
        }))
      );
    }

    const group = await buildGroupResponse(req.params.groupId);
    res.json(group);
  } catch (err) {
    console.error("Start swiping error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

router.get("/:groupId/restaurants", authMiddleware, async (req: AuthRequest, res: Response) => {
  const restaurants = await db
    .select()
    .from(groupRestaurantsTable)
    .where(eq(groupRestaurantsTable.groupId, req.params.groupId));

  res.json(restaurants.map(r => ({
    id: r.id,
    placeId: r.placeId,
    name: r.name,
    address: r.address,
    rating: r.rating,
    reviewCount: r.reviewCount,
    priceLevel: r.priceLevel,
    photos: r.photos ?? [],
    cuisine: r.cuisine,
    openNow: r.openNow,
    distance: r.distance,
    lat: r.lat,
    lng: r.lng,
    mapsUrl: r.mapsUrl,
    menuSearchUrl: `https://www.google.com/search?q=${encodeURIComponent(r.name + " " + (r.address ?? "") + " menu")}`,
    menuItems: r.menuItems ?? [],
    reviews: r.reviews ?? [],
  })));
});

router.post("/:groupId/votes", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { restaurantId, liked } = req.body as { restaurantId: string; liked: boolean };

    const existing = await db
      .select()
      .from(votesTable)
      .where(
        and(
          eq(votesTable.groupId, req.params.groupId),
          eq(votesTable.userId, req.userId!),
          eq(votesTable.restaurantId, restaurantId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(votesTable).values({
        id: generateId(),
        groupId: req.params.groupId,
        userId: req.userId!,
        restaurantId,
        liked,
      });
    }

    const allRestaurants = await db
      .select()
      .from(groupRestaurantsTable)
      .where(eq(groupRestaurantsTable.groupId, req.params.groupId));

    const userVotes = await db
      .select()
      .from(votesTable)
      .where(
        and(
          eq(votesTable.groupId, req.params.groupId),
          eq(votesTable.userId, req.userId!)
        )
      );

    if (userVotes.length >= allRestaurants.length) {
      await db
        .update(groupMembersTable)
        .set({ status: "done", doneAt: new Date() })
        .where(
          and(
            eq(groupMembersTable.groupId, req.params.groupId),
            eq(groupMembersTable.userId, req.userId!)
          )
        );

      const allMembers = await db
        .select()
        .from(groupMembersTable)
        .where(eq(groupMembersTable.groupId, req.params.groupId));

      const joinedMembers = allMembers.filter(m => m.status === "joined" || m.status === "done");
      const doneMembers = allMembers.filter(m => m.status === "done");

      if (doneMembers.length >= joinedMembers.length && joinedMembers.length > 0) {
        await db
          .update(groupsTable)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(groupsTable.id, req.params.groupId));
      }

      res.json({
        allDone: doneMembers.length >= joinedMembers.length,
        doneCount: doneMembers.length,
        totalCount: joinedMembers.length,
      });
    } else {
      const members = await db
        .select()
        .from(groupMembersTable)
        .where(eq(groupMembersTable.groupId, req.params.groupId));

      const joinedMembers = members.filter(m => m.status === "joined" || m.status === "done");
      const doneMembers = members.filter(m => m.status === "done");

      res.json({
        allDone: false,
        doneCount: doneMembers.length,
        totalCount: joinedMembers.length,
      });
    }
  } catch (err) {
    console.error("Vote error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

router.delete("/:groupId/leave", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { groupId } = req.params;
    const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
    if (!group) return res.status(404).json({ error: "not_found" });
    if (group.creatorId === req.userId) return res.status(400).json({ error: "creator_cannot_leave" });

    await db
      .delete(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, req.userId!)));

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Leave group error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

router.delete("/:groupId", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { groupId } = req.params;
    const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
    if (!group) return res.status(404).json({ error: "not_found" });
    if (group.creatorId !== req.userId) return res.status(403).json({ error: "forbidden" });

    const restaurantRows = await db
      .select({ id: groupRestaurantsTable.id })
      .from(groupRestaurantsTable)
      .where(eq(groupRestaurantsTable.groupId, groupId));

    const restaurantIds = restaurantRows.map(r => r.id);
    if (restaurantIds.length > 0) {
      await db.delete(votesTable).where(inArray(votesTable.restaurantId, restaurantIds));
    }
    await db.delete(groupRestaurantsTable).where(eq(groupRestaurantsTable.groupId, groupId));
    await db.delete(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
    await db.delete(groupsTable).where(eq(groupsTable.id, groupId));

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Delete group error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

router.get("/:groupId/results", authMiddleware, async (req: AuthRequest, res: Response) => {
  const restaurants = await db
    .select()
    .from(groupRestaurantsTable)
    .where(eq(groupRestaurantsTable.groupId, req.params.groupId));

  const votes = await db
    .select()
    .from(votesTable)
    .where(eq(votesTable.groupId, req.params.groupId));

  const results = restaurants.map(r => {
    const restaurantVotes = votes.filter(v => v.restaurantId === r.id);
    const likeCount = restaurantVotes.filter(v => v.liked).length;
    const dislikeCount = restaurantVotes.filter(v => !v.liked).length;
    const totalVotes = restaurantVotes.length;
    const score = totalVotes > 0 ? likeCount / totalVotes : 0;

    return {
      restaurant: {
        id: r.id,
        placeId: r.placeId,
        name: r.name,
        address: r.address,
        rating: r.rating,
        reviewCount: r.reviewCount,
        priceLevel: r.priceLevel,
        photos: r.photos ?? [],
        cuisine: r.cuisine,
        openNow: r.openNow,
        distance: r.distance,
        lat: r.lat,
        lng: r.lng,
        mapsUrl: r.mapsUrl,
        menuSearchUrl: `https://www.google.com/search?q=${encodeURIComponent(r.name + " " + (r.address ?? "") + " menu")}`,
        menuItems: r.menuItems ?? [],
        reviews: r.reviews ?? [],
      },
      likeCount,
      dislikeCount,
      totalVotes,
      score,
    };
  });

  results.sort((a, b) => b.likeCount - a.likeCount || b.score - a.score);
  res.json(results);
});

const VENUE_TYPE_MAP: Record<string, string> = {
  restaurant: "restaurant",
  cafe: "cafe",
  bar: "bar",
};

// ── Places API (New) types ────────────────────────────────────────────────────

interface NewPlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  photos?: Array<{ name: string }>;
  reviews?: NewReview[];
  currentOpeningHours?: { openNow: boolean };
  regularOpeningHours?: { openNow: boolean };
  location?: { latitude: number; longitude: number };
  types?: string[];
  primaryTypeDisplayName?: { text: string };
  googleMapsUri?: string;
}

interface NewReview {
  authorAttribution?: { displayName: string; photoUri?: string };
  rating?: number;
  text?: { text: string };
  relativePublishTimeDescription?: string;
}

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

async function fetchRestaurants(lat: number, lng: number, radius: number, venueType: string, apiKey?: string) {
  if (!apiKey) {
    return generateMockRestaurants(lat, lng);
  }

  const includedType = VENUE_TYPE_MAP[venueType] ?? "restaurant";

  try {
    // Places API (New) — Nearby Search
    const fieldMask = [
      "places.id",
      "places.displayName",
      "places.formattedAddress",
      "places.rating",
      "places.userRatingCount",
      "places.priceLevel",
      "places.photos",
      "places.reviews",
      "places.currentOpeningHours",
      "places.regularOpeningHours",
      "places.location",
      "places.types",
      "places.primaryTypeDisplayName",
      "places.googleMapsUri",
    ].join(",");

    const searchResp = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify({
        includedTypes: [includedType],
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: Math.min(radius, 50000),
          },
        },
        rankPreference: "POPULARITY",
      }),
    });

    const searchData = await searchResp.json() as { places?: NewPlace[]; error?: { message: string } };

    if (searchData.error) {
      console.error("Places API (New) error:", searchData.error.message);
      return generateMockRestaurants(lat, lng);
    }

    const places = searchData.places ?? [];
    if (!places.length) return generateMockRestaurants(lat, lng);

    const results: PlaceRestaurant[] = places
      .filter(p => p.location)
      .map(p => {
        const placeLat = p.location!.latitude;
        const placeLng = p.location!.longitude;

        // Build photo URLs using the new photo media endpoint
        const photoUrls = (p.photos ?? []).slice(0, 5).map(photo =>
          `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=800&key=${apiKey}`
        );

        const openNow =
          p.currentOpeningHours?.openNow ??
          p.regularOpeningHours?.openNow ??
          null;

        const priceNum = p.priceLevel ? (PRICE_LEVEL_MAP[p.priceLevel] ?? null) : null;

        const reviews = (p.reviews ?? []).slice(0, 3).map(r => ({
          authorName: r.authorAttribution?.displayName ?? "Anonymous",
          rating: r.rating ?? 0,
          text: r.text?.text ?? "",
          timeAgo: r.relativePublishTimeDescription ?? "",
          authorPhoto: r.authorAttribution?.photoUri ?? null,
        }));

        const cuisine =
          p.primaryTypeDisplayName?.text ??
          extractCuisine(p.types ?? []);

        return {
          placeId: p.id,
          name: p.displayName?.text ?? "Unknown",
          address: p.formattedAddress ?? "",
          rating: p.rating ?? null,
          reviewCount: p.userRatingCount ?? null,
          priceLevel: priceNum,
          photos: photoUrls,
          cuisine,
          openNow,
          distance: calcDistance(lat, lng, placeLat, placeLng),
          lat: placeLat,
          lng: placeLng,
          mapsUrl: p.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${p.id}`,
          menuItems: [] as { name: string; description?: string; category: string; price?: string }[],
          reviews,
        } satisfies PlaceRestaurant;
      });

    return results.length > 0 ? results : generateMockRestaurants(lat, lng);
  } catch (err) {
    console.error("Places API (New) error:", err);
    return generateMockRestaurants(lat, lng);
  }
}

type PlaceRestaurant = {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: number | null;
  photos: string[];
  cuisine: string;
  openNow: boolean | null;
  distance: number;
  lat: number;
  lng: number;
  mapsUrl: string;
  menuItems: { name: string; description?: string; category: string; price?: string }[];
  reviews: { authorName: string; rating: number; text: string; timeAgo: string; authorPhoto: string | null }[];
};

function extractCuisine(types: string[]): string {
  const map: Record<string, string> = {
    italian_restaurant: "Italian",
    japanese_restaurant: "Japanese",
    chinese_restaurant: "Chinese",
    mexican_restaurant: "Mexican",
    indian_restaurant: "Indian",
    thai_restaurant: "Thai",
    french_restaurant: "French",
    mediterranean_restaurant: "Mediterranean",
    american_restaurant: "American",
    sushi_restaurant: "Sushi",
    seafood_restaurant: "Seafood",
    steakhouse: "Steakhouse",
    pizza_restaurant: "Pizza",
    burger_restaurant: "Burgers",
    cafe: "Cafe",
    bar: "Bar",
    bakery: "Bakery",
  };

  for (const type of types) {
    if (map[type]) return map[type];
  }
  return "Restaurant";
}

function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function generateMockRestaurants(lat: number, lng: number) {
  const restaurants = [
    {
      placeId: "mock_1",
      name: "The Golden Fork",
      address: "123 Main St",
      rating: 4.6,
      reviewCount: 342,
      priceLevel: 2,
      photos: ["https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800"],
      cuisine: "Italian",
      openNow: true,
      distance: 450,
      lat: lat + 0.002,
      lng: lng + 0.001,
      mapsUrl: "",
      menuItems: [
        { name: "Truffle Risotto", description: "Creamy Arborio rice with black truffle", category: "dish", price: "$24" },
        { name: "Tiramisu", description: "Classic Italian dessert with espresso", category: "dessert", price: "$10" },
        { name: "House Negroni", description: "Gin, Campari, sweet vermouth", category: "drink", price: "$14" },
      ],
      reviews: [
        { authorName: "Sarah K.", rating: 5, text: "Absolutely divine truffle pasta. The ambiance is perfect for a date night.", timeAgo: "2 weeks ago" },
        { authorName: "Mike T.", rating: 4, text: "Great food, slightly slow service but worth it for the quality.", timeAgo: "1 month ago" },
      ],
    },
    {
      placeId: "mock_2",
      name: "Sakura Garden",
      address: "456 Oak Avenue",
      rating: 4.8,
      reviewCount: 567,
      priceLevel: 3,
      photos: ["https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800"],
      cuisine: "Japanese",
      openNow: true,
      distance: 720,
      lat: lat - 0.003,
      lng: lng + 0.002,
      mapsUrl: "",
      menuItems: [
        { name: "Omakase Set", description: "Chef's selection of seasonal sushi", category: "dish", price: "$85" },
        { name: "Wagyu Tataki", description: "Lightly seared A5 Wagyu with ponzu", category: "dish", price: "$42" },
        { name: "Yuzu Sake Cocktail", description: "Premium sake with fresh yuzu", category: "drink", price: "$16" },
        { name: "Mochi Ice Cream", description: "Assorted mochi with green tea filling", category: "dessert", price: "$12" },
      ],
      reviews: [
        { authorName: "Emma L.", rating: 5, text: "Best sushi in the city! The omakase experience is unforgettable.", timeAgo: "3 days ago" },
        { authorName: "James R.", rating: 5, text: "Impeccable quality and presentation. Every dish is a work of art.", timeAgo: "1 week ago" },
      ],
    },
    {
      placeId: "mock_3",
      name: "Smoke & Soul BBQ",
      address: "789 Elm Street",
      rating: 4.4,
      reviewCount: 891,
      priceLevel: 2,
      photos: ["https://images.unsplash.com/photo-1544025162-d76694265947?w=800"],
      cuisine: "American",
      openNow: true,
      distance: 1100,
      lat: lat + 0.005,
      lng: lng - 0.003,
      mapsUrl: "",
      menuItems: [
        { name: "Brisket Platter", description: "12-hour smoked beef brisket with sides", category: "dish", price: "$28" },
        { name: "Baby Back Ribs", description: "Fall-off-the-bone pork ribs", category: "dish", price: "$32" },
        { name: "Craft Beer Flight", description: "4 rotating local craft beers", category: "drink", price: "$16" },
        { name: "Banana Pudding", description: "Homemade with vanilla wafers", category: "dessert", price: "$8" },
      ],
      reviews: [
        { authorName: "Carlos M.", rating: 5, text: "The brisket is out of this world. Perfectly smoked every single time.", timeAgo: "5 days ago" },
        { authorName: "Priya S.", rating: 4, text: "Massive portions and great flavor. Gets busy on weekends.", timeAgo: "2 weeks ago" },
      ],
    },
    {
      placeId: "mock_4",
      name: "Le Petit Bistro",
      address: "321 Rue Lafayette",
      rating: 4.7,
      reviewCount: 234,
      priceLevel: 3,
      photos: ["https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800"],
      cuisine: "French",
      openNow: false,
      distance: 890,
      lat: lat - 0.001,
      lng: lng - 0.004,
      mapsUrl: "",
      menuItems: [
        { name: "Duck Confit", description: "Slow-cooked duck leg with lentils du Puy", category: "dish", price: "$36" },
        { name: "Soufflé au Chocolat", description: "Dark chocolate soufflé with crème anglaise", category: "dessert", price: "$18" },
        { name: "Kir Royale", description: "Champagne with blackcurrant liqueur", category: "drink", price: "$15" },
      ],
      reviews: [
        { authorName: "Sophie D.", rating: 5, text: "Transported to Paris! The duck confit rivals any restaurant in France.", timeAgo: "1 week ago" },
        { authorName: "Thomas W.", rating: 4, text: "Romantic atmosphere, excellent wine list, authentic French cuisine.", timeAgo: "3 weeks ago" },
      ],
    },
    {
      placeId: "mock_5",
      name: "Taco Loco",
      address: "555 Fiesta Blvd",
      rating: 4.3,
      reviewCount: 1205,
      priceLevel: 1,
      photos: ["https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800"],
      cuisine: "Mexican",
      openNow: true,
      distance: 340,
      lat: lat + 0.001,
      lng: lng - 0.002,
      mapsUrl: "",
      menuItems: [
        { name: "Al Pastor Tacos", description: "Spit-roasted pork with pineapple & cilantro", category: "dish", price: "$4" },
        { name: "Guacamole & Chips", description: "Made fresh tableside", category: "dish", price: "$11" },
        { name: "Margarita Clásica", description: "Fresh lime, tequila, Cointreau on the rocks", category: "drink", price: "$12" },
        { name: "Churros con Chocolate", description: "Crispy churros with dark chocolate dipping sauce", category: "dessert", price: "$9" },
      ],
      reviews: [
        { authorName: "Diego R.", rating: 5, text: "Authentic street-style tacos. The al pastor is the real deal.", timeAgo: "Yesterday" },
        { authorName: "Ana G.", rating: 4, text: "Always fresh and flavorful. Best margaritas in town!", timeAgo: "4 days ago" },
      ],
    },
    {
      placeId: "mock_6",
      name: "Spice Route",
      address: "88 Curry Lane",
      rating: 4.5,
      reviewCount: 456,
      priceLevel: 2,
      photos: ["https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800"],
      cuisine: "Indian",
      openNow: true,
      distance: 1300,
      lat: lat - 0.004,
      lng: lng + 0.003,
      mapsUrl: "",
      menuItems: [
        { name: "Butter Chicken", description: "Tender chicken in rich tomato-cream sauce", category: "dish", price: "$18" },
        { name: "Lamb Biryani", description: "Fragrant basmati rice with slow-cooked lamb", category: "dish", price: "$22" },
        { name: "Mango Lassi", description: "Chilled yogurt drink with Alphonso mango", category: "drink", price: "$7" },
        { name: "Gulab Jamun", description: "Milk dumplings in rose-cardamom syrup", category: "dessert", price: "$8" },
      ],
      reviews: [
        { authorName: "Aisha P.", rating: 5, text: "Best Indian food outside of India! The biryani is absolutely incredible.", timeAgo: "2 days ago" },
        { authorName: "David K.", rating: 4, text: "Authentic spices and generous portions. Love the mango lassi.", timeAgo: "2 weeks ago" },
      ],
    },
    {
      placeId: "mock_7",
      name: "The Rooftop Grill",
      address: "1 Skyline Tower",
      rating: 4.6,
      reviewCount: 678,
      priceLevel: 3,
      photos: ["https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800"],
      cuisine: "Steakhouse",
      openNow: true,
      distance: 2100,
      lat: lat + 0.006,
      lng: lng + 0.004,
      mapsUrl: "",
      menuItems: [
        { name: "Dry-Aged Ribeye", description: "28-day dry-aged 16oz with truffle butter", category: "dish", price: "$65" },
        { name: "Lobster Thermidor", description: "Classic French preparation with Gruyère", category: "dish", price: "$72" },
        { name: "Old Fashioned", description: "Bourbon, bitters, orange peel, cherry", category: "drink", price: "$18" },
        { name: "Crème Brûlée", description: "Classic vanilla with caramelized sugar", category: "dessert", price: "$14" },
      ],
      reviews: [
        { authorName: "Nathan B.", rating: 5, text: "Spectacular views and even better steak. Worth every penny.", timeAgo: "1 week ago" },
        { authorName: "Rachel S.", rating: 5, text: "The ribeye is perfection. Best dining experience of the year.", timeAgo: "3 weeks ago" },
      ],
    },
    {
      placeId: "mock_8",
      name: "Ocean Blue Seafood",
      address: "12 Harbor Drive",
      rating: 4.4,
      reviewCount: 329,
      priceLevel: 3,
      photos: ["https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800"],
      cuisine: "Seafood",
      openNow: true,
      distance: 1800,
      lat: lat - 0.005,
      lng: lng - 0.001,
      mapsUrl: "",
      menuItems: [
        { name: "Whole Grilled Branzino", description: "Mediterranean sea bass with lemon caper butter", category: "dish", price: "$38" },
        { name: "Oyster Dozen", description: "Fresh daily selection from local waters", category: "dish", price: "$32" },
        { name: "White Sangria", description: "White wine, peach, citrus, mint", category: "drink", price: "$13" },
        { name: "Lemon Tart", description: "Zesty lemon curd in buttery pastry shell", category: "dessert", price: "$12" },
      ],
      reviews: [
        { authorName: "Linda H.", rating: 4, text: "Freshest seafood in the city. The oysters are always perfectly chilled.", timeAgo: "4 days ago" },
        { authorName: "Kevin O.", rating: 5, text: "Branzino was cooked to perfection. Great waterfront location.", timeAgo: "2 weeks ago" },
      ],
    },
    {
      placeId: "mock_9",
      name: "Green Earth Kitchen",
      address: "77 Garden Way",
      rating: 4.5,
      reviewCount: 412,
      priceLevel: 2,
      photos: ["https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800"],
      cuisine: "Vegetarian",
      openNow: true,
      distance: 650,
      lat: lat + 0.003,
      lng: lng - 0.005,
      mapsUrl: "",
      menuItems: [
        { name: "Mushroom Wellington", description: "Wild mushroom duxelles in golden pastry", category: "dish", price: "$26" },
        { name: "Buddha Bowl", description: "Quinoa, roasted veggies, tahini dressing", category: "dish", price: "$16" },
        { name: "Kombucha Flight", description: "4 flavors of house-brewed kombucha", category: "drink", price: "$14" },
        { name: "Raw Cheesecake", description: "Cashew-based with seasonal fruit", category: "dessert", price: "$11" },
      ],
      reviews: [
        { authorName: "Maya C.", rating: 5, text: "Proof that plant-based eating can be exciting and delicious.", timeAgo: "1 week ago" },
        { authorName: "Tom F.", rating: 4, text: "Even as a meat-lover, I was blown away by the mushroom wellington.", timeAgo: "3 weeks ago" },
      ],
    },
    {
      placeId: "mock_10",
      name: "Craft & Barrel",
      address: "200 Brewery Row",
      rating: 4.3,
      reviewCount: 987,
      priceLevel: 2,
      photos: ["https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800"],
      cuisine: "American",
      openNow: true,
      distance: 930,
      lat: lat - 0.002,
      lng: lng + 0.005,
      mapsUrl: "",
      menuItems: [
        { name: "Smash Burger", description: "Double smashed patty, American cheese, special sauce", category: "dish", price: "$17" },
        { name: "Truffle Fries", description: "Shoestring fries with truffle oil and parmesan", category: "dish", price: "$12" },
        { name: "Craft Beer Tall Boy", description: "Rotating seasonal draft, 20oz", category: "drink", price: "$9" },
        { name: "Cookie Skillet", description: "Warm chocolate chip cookie with vanilla ice cream", category: "dessert", price: "$13" },
      ],
      reviews: [
        { authorName: "Jake M.", rating: 4, text: "Best smash burger I've had outside of a food truck. Perfect lunch spot.", timeAgo: "2 days ago" },
        { authorName: "Amy B.", rating: 5, text: "Casual vibe, incredible food, great beer selection. My go-to.", timeAgo: "1 week ago" },
      ],
    },
  ];

  return restaurants;
}

export default router;
