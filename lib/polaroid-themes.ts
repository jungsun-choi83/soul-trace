import {
  HALLOWEEN_POLAROID_THEME,
  type PolaroidStatus,
  type SeasonalOption,
  type SeasonalPolaroidTheme,
  type WhisperRule,
} from "./seasonal-polaroid.ts";
import {
  isPolaroidThemeId,
  type PolaroidThemeId,
} from "./polaroid-theme-catalog.ts";

const LIVING: readonly PolaroidStatus[] = ["living"];
const PASSED: readonly PolaroidStatus[] = ["passed"];

const option = (id: string, emoji: string, labelKey: string, only?: readonly PolaroidStatus[]): SeasonalOption => ({
  id,
  emoji,
  labelKey,
  ...(only ? { only } : {}),
});

const whisper = (id: string, key: string, only?: readonly PolaroidStatus[]): WhisperRule => ({
  id,
  key,
  ...(only ? { only } : {}),
});

function withSharedIdentity(spec: {
  id: PolaroidThemeId;
  costumes: readonly SeasonalOption[];
  scenes: readonly SeasonalOption[];
  vibes: readonly SeasonalOption[];
  costumeWhispers: readonly WhisperRule[];
  sceneWhispers: readonly WhisperRule[];
  vibeWhispers: readonly WhisperRule[];
}): SeasonalPolaroidTheme {
  const base = HALLOWEEN_POLAROID_THEME;
  return {
    id: spec.id,
    costumes: spec.costumes,
    scenes: spec.scenes,
    vibes: spec.vibes,
    personalities: base.personalities,
    habitsBySpecies: base.habitsBySpecies,
    treatsBySpecies: base.treatsBySpecies,
    callNames: base.callNames,
    whispers: {
      default: base.whispers.default,
      photo: base.whispers.photo,
      costume: spec.costumeWhispers,
      scene: spec.sceneWhispers,
      vibe: spec.vibeWhispers,
      personality: base.whispers.personality,
      habit: base.whispers.habit,
      treat: base.whispers.treat,
      callName: base.whispers.callName,
    },
  };
}

const FELT_DOLL_THEME = withSharedIdentity({
  id: "felt-doll",
  costumes: [
    option("knit-scarf", "🧣", "options.costumes.knitScarf"),
    option("tiny-cardigan", "🧶", "options.costumes.tinyCardigan"),
    option("felt-bow", "🎀", "options.costumes.feltBow"),
    option("wool-hat", "🎩", "options.costumes.woolHat"),
    option("felt-plain", "✦", "options.costumes.feltPlain"),
    option("surprise", "✨", "options.costumes.surprise"),
  ],
  scenes: [
    option("window-seat", "🪟", "options.scenes.windowSeat"),
    option("tiny-armchair", "🪑", "options.scenes.tinyArmchair"),
    option("knitting-basket", "🧺", "options.scenes.knittingBasket"),
    option("sunny-rug", "☀️", "options.scenes.sunnyRug", LIVING),
    option("quiet-shelf", "📚", "options.scenes.quietShelf", PASSED),
  ],
  vibes: [
    option("cute-cozy", "🧡", "options.vibes.cuteCozy"),
    option("sleepy-soft", "🌙", "options.vibes.sleepySoft"),
    option("playful-warm", "🌼", "options.vibes.playfulWarm", LIVING),
    option("gentle-warm", "🕯️", "options.vibes.gentleWarm", PASSED),
  ],
  costumeWhispers: [
    whisper("knit-scarf", "whispers.costume.knitScarf"),
    whisper("tiny-cardigan", "whispers.costume.tinyCardigan"),
    whisper("felt-bow", "whispers.costume.feltBow"),
    whisper("wool-hat", "whispers.costume.woolHat"),
    whisper("felt-plain", "whispers.costume.feltPlain"),
    whisper("surprise", "whispers.costume.surprise"),
  ],
  sceneWhispers: [
    whisper("window-seat", "whispers.scene.windowSeat"),
    whisper("tiny-armchair", "whispers.scene.tinyArmchair"),
    whisper("knitting-basket", "whispers.scene.knittingBasket"),
    whisper("sunny-rug", "whispers.scene.sunnyRug", LIVING),
    whisper("quiet-shelf", "whispers.scene.quietShelf", PASSED),
  ],
  vibeWhispers: [
    whisper("cute-cozy", "whispers.vibe.cuteCozy"),
    whisper("sleepy-soft", "whispers.vibe.sleepySoft"),
    whisper("playful-warm", "whispers.vibe.playfulWarm", LIVING),
    whisper("gentle-warm", "whispers.vibe.gentleWarm", PASSED),
  ],
});

const GOUACHE_STORY_THEME = withSharedIdentity({
  id: "gouache-story",
  costumes: [
    option("picture-cape", "🧥", "options.costumes.pictureCape"),
    option("flower-crown", "🌸", "options.costumes.flowerCrown"),
    option("rain-boots", "👢", "options.costumes.rainBoots"),
    option("picnic-ribbon", "🎀", "options.costumes.picnicRibbon"),
    option("surprise", "✨", "options.costumes.surprise"),
  ],
  scenes: [
    option("meadow-path", "🌿", "options.scenes.meadowPath"),
    option("storybook-kitchen", "🏠", "options.scenes.storybookKitchen"),
    option("village-bridge", "🌉", "options.scenes.villageBridge", LIVING),
    option("rainy-window", "🌧️", "options.scenes.rainyWindow"),
    option("star-hill", "⭐", "options.scenes.starHill", PASSED),
  ],
  vibes: [
    option("bright-story", "🌞", "options.vibes.brightStory"),
    option("quiet-page", "📖", "options.vibes.quietPage"),
    option("wind-in-grass", "🍃", "options.vibes.windInGrass", LIVING),
    option("gentle-warm", "🕯️", "options.vibes.gentleWarm", PASSED),
  ],
  costumeWhispers: [
    whisper("picture-cape", "whispers.costume.pictureCape"),
    whisper("flower-crown", "whispers.costume.flowerCrown"),
    whisper("rain-boots", "whispers.costume.rainBoots"),
    whisper("picnic-ribbon", "whispers.costume.picnicRibbon"),
    whisper("surprise", "whispers.costume.surprise"),
  ],
  sceneWhispers: [
    whisper("meadow-path", "whispers.scene.meadowPath"),
    whisper("storybook-kitchen", "whispers.scene.storybookKitchen"),
    whisper("village-bridge", "whispers.scene.villageBridge", LIVING),
    whisper("rainy-window", "whispers.scene.rainyWindow"),
    whisper("star-hill", "whispers.scene.starHill", PASSED),
  ],
  vibeWhispers: [
    whisper("bright-story", "whispers.vibe.brightStory"),
    whisper("quiet-page", "whispers.vibe.quietPage"),
    whisper("wind-in-grass", "whispers.vibe.windInGrass", LIVING),
    whisper("gentle-warm", "whispers.vibe.gentleWarm", PASSED),
  ],
});

const PAPER_COLLAGE_THEME = withSharedIdentity({
  id: "paper-collage",
  costumes: [
    option("paper-crown", "👑", "options.costumes.paperCrown"),
    option("folded-cape", "📄", "options.costumes.foldedCape"),
    option("button-bow", "🔘", "options.costumes.buttonBow"),
    option("leaf-collar", "🍂", "options.costumes.leafCollar"),
    option("surprise", "✨", "options.costumes.surprise"),
  ],
  scenes: [
    option("paper-living-room", "🏡", "options.scenes.paperLivingRoom"),
    option("cutout-park", "🌳", "options.scenes.cutoutPark", LIVING),
    option("collage-kitchen", "🍞", "options.scenes.collageKitchen"),
    option("paper-sky", "☁️", "options.scenes.paperSky"),
    option("quiet-paper-garden", "🌷", "options.scenes.quietPaperGarden", PASSED),
  ],
  vibes: [
    option("handmade-warm", "📎", "options.vibes.handmadeWarm"),
    option("playful-cut", "✂️", "options.vibes.playfulCut", LIVING),
    option("soft-pastel", "🩷", "options.vibes.softPastel"),
    option("gentle-warm", "🕯️", "options.vibes.gentleWarm", PASSED),
  ],
  costumeWhispers: [
    whisper("paper-crown", "whispers.costume.paperCrown"),
    whisper("folded-cape", "whispers.costume.foldedCape"),
    whisper("button-bow", "whispers.costume.buttonBow"),
    whisper("leaf-collar", "whispers.costume.leafCollar"),
    whisper("surprise", "whispers.costume.surprise"),
  ],
  sceneWhispers: [
    whisper("paper-living-room", "whispers.scene.paperLivingRoom"),
    whisper("cutout-park", "whispers.scene.cutoutPark", LIVING),
    whisper("collage-kitchen", "whispers.scene.collageKitchen"),
    whisper("paper-sky", "whispers.scene.paperSky"),
    whisper("quiet-paper-garden", "whispers.scene.quietPaperGarden", PASSED),
  ],
  vibeWhispers: [
    whisper("handmade-warm", "whispers.vibe.handmadeWarm"),
    whisper("playful-cut", "whispers.vibe.playfulCut", LIVING),
    whisper("soft-pastel", "whispers.vibe.softPastel"),
    whisper("gentle-warm", "whispers.vibe.gentleWarm", PASSED),
  ],
});

const STARLIGHT_OIL_THEME = withSharedIdentity({
  id: "starlight-oil",
  costumes: [
    option("midnight-scarf", "🌌", "options.costumes.midnightScarf"),
    option("star-ribbon", "⭐", "options.costumes.starRibbon"),
    option("painter-collar", "🎨", "options.costumes.painterCollar"),
    option("lantern-charm", "🏮", "options.costumes.lanternCharm"),
    option("little-angel", "😇", "options.costumes.littleAngel", PASSED),
    option("surprise", "✨", "options.costumes.surprise"),
  ],
  scenes: [
    option("starlit-field", "🌠", "options.scenes.starlitField"),
    option("studio-night", "🖼️", "options.scenes.studioNight"),
    option("moon-porch", "🌙", "options.scenes.moonPorch", LIVING),
    option("quiet-lake", "🌊", "options.scenes.quietLake"),
    option("lantern-meadow", "🏮", "options.scenes.lanternMeadow", PASSED),
  ],
  vibes: [
    option("glowing-quiet", "✨", "options.vibes.glowingQuiet"),
    option("painterly-warm", "🖌️", "options.vibes.painterlyWarm"),
    option("deep-night", "🌃", "options.vibes.deepNight", LIVING),
    option("gentle-warm", "🕯️", "options.vibes.gentleWarm", PASSED),
  ],
  costumeWhispers: [
    whisper("midnight-scarf", "whispers.costume.midnightScarf"),
    whisper("star-ribbon", "whispers.costume.starRibbon"),
    whisper("painter-collar", "whispers.costume.painterCollar"),
    whisper("lantern-charm", "whispers.costume.lanternCharm"),
    whisper("little-angel", "whispers.costume.littleAngel", PASSED),
    whisper("surprise", "whispers.costume.surprise"),
  ],
  sceneWhispers: [
    whisper("starlit-field", "whispers.scene.starlitField"),
    whisper("studio-night", "whispers.scene.studioNight"),
    whisper("moon-porch", "whispers.scene.moonPorch", LIVING),
    whisper("quiet-lake", "whispers.scene.quietLake"),
    whisper("lantern-meadow", "whispers.scene.lanternMeadow", PASSED),
  ],
  vibeWhispers: [
    whisper("glowing-quiet", "whispers.vibe.glowingQuiet"),
    whisper("painterly-warm", "whispers.vibe.painterlyWarm"),
    whisper("deep-night", "whispers.vibe.deepNight", LIVING),
    whisper("gentle-warm", "whispers.vibe.gentleWarm", PASSED),
  ],
});

const MINIATURE_WORLD_THEME = withSharedIdentity({
  id: "miniature-world",
  costumes: [
    option("tiny-coat", "🧥", "options.costumes.tinyCoat"),
    option("diorama-hat", "🎩", "options.costumes.dioramaHat"),
    option("scale-scarf", "🧣", "options.costumes.scaleScarf"),
    option("surprise", "✨", "options.costumes.surprise"),
  ],
  scenes: [
    option("tiny-street", "🏘️", "options.scenes.tinyStreet", LIVING),
    option("matchbox-room", "📦", "options.scenes.matchboxRoom"),
    option("bottle-garden", "🧴", "options.scenes.bottleGarden"),
    option("quiet-diorama", "🪵", "options.scenes.quietDiorama", PASSED),
  ],
  vibes: [
    option("tiny-wonder", "🔍", "options.vibes.tinyWonder"),
    option("handmade-warm", "📎", "options.vibes.handmadeWarm"),
    option("gentle-warm", "🕯️", "options.vibes.gentleWarm", PASSED),
  ],
  costumeWhispers: [
    whisper("tiny-coat", "whispers.costume.tinyCoat"),
    whisper("diorama-hat", "whispers.costume.dioramaHat"),
    whisper("scale-scarf", "whispers.costume.scaleScarf"),
    whisper("surprise", "whispers.costume.surprise"),
  ],
  sceneWhispers: [
    whisper("tiny-street", "whispers.scene.tinyStreet", LIVING),
    whisper("matchbox-room", "whispers.scene.matchboxRoom"),
    whisper("bottle-garden", "whispers.scene.bottleGarden"),
    whisper("quiet-diorama", "whispers.scene.quietDiorama", PASSED),
  ],
  vibeWhispers: [
    whisper("tiny-wonder", "whispers.vibe.tinyWonder"),
    whisper("handmade-warm", "whispers.vibe.handmadeWarm"),
    whisper("gentle-warm", "whispers.vibe.gentleWarm", PASSED),
  ],
});

const CRAYON_DIARY_THEME = withSharedIdentity({
  id: "crayon-diary",
  costumes: [
    option("crayon-bow", "🎀", "options.costumes.crayonBow"),
    option("scribble-cape", "🖍️", "options.costumes.scribbleCape"),
    option("notebook-sticker", "📒", "options.costumes.notebookSticker"),
    option("surprise", "✨", "options.costumes.surprise"),
  ],
  scenes: [
    option("diary-page", "📓", "options.scenes.diaryPage"),
    option("crayon-park", "🌳", "options.scenes.crayonPark", LIVING),
    option("kitchen-doodle", "🍪", "options.scenes.kitchenDoodle"),
    option("quiet-margin", "✏️", "options.scenes.quietMargin", PASSED),
  ],
  vibes: [
    option("handmade-warm", "📎", "options.vibes.handmadeWarm"),
    option("playful-warm", "🌼", "options.vibes.playfulWarm", LIVING),
    option("gentle-warm", "🕯️", "options.vibes.gentleWarm", PASSED),
  ],
  costumeWhispers: [
    whisper("crayon-bow", "whispers.costume.crayonBow"),
    whisper("scribble-cape", "whispers.costume.scribbleCape"),
    whisper("notebook-sticker", "whispers.costume.notebookSticker"),
    whisper("surprise", "whispers.costume.surprise"),
  ],
  sceneWhispers: [
    whisper("diary-page", "whispers.scene.diaryPage"),
    whisper("crayon-park", "whispers.scene.crayonPark", LIVING),
    whisper("kitchen-doodle", "whispers.scene.kitchenDoodle"),
    whisper("quiet-margin", "whispers.scene.quietMargin", PASSED),
  ],
  vibeWhispers: [
    whisper("handmade-warm", "whispers.vibe.handmadeWarm"),
    whisper("playful-warm", "whispers.vibe.playfulWarm", LIVING),
    whisper("gentle-warm", "whispers.vibe.gentleWarm", PASSED),
  ],
});

const CHRISTMAS_LITTLE_GHOST_THEME = withSharedIdentity({
  id: "christmas-little-ghost",
  costumes: [
    option("tiny-bell-collar", "🔔", "options.costumes.tinyBellCollar"),
    option("knit-cape", "🧶", "options.costumes.knitCape"),
    option("snow-scarf", "🧣", "options.costumes.snowScarf"),
    option("ghost-friend-bow", "👻", "options.costumes.ghostFriendBow"),
    option("surprise", "✨", "options.costumes.surprise"),
  ],
  scenes: [
    option("candle-window", "🕯️", "options.scenes.candleWindow"),
    option("snowy-garden", "❄️", "options.scenes.snowyGarden", LIVING),
    option("attic-glow", "🏠", "options.scenes.atticGlow"),
    option("quiet-tree", "🎄", "options.scenes.quietTree", PASSED),
  ],
  vibes: [
    option("christmas-cozy", "🎄", "options.vibes.christmasCozy"),
    option("wonder-soft", "✨", "options.vibes.wonderSoft"),
    option("gentle-warm", "🕯️", "options.vibes.gentleWarm", PASSED),
  ],
  costumeWhispers: [
    whisper("tiny-bell-collar", "whispers.costume.tinyBellCollar"),
    whisper("knit-cape", "whispers.costume.knitCape"),
    whisper("snow-scarf", "whispers.costume.snowScarf"),
    whisper("ghost-friend-bow", "whispers.costume.ghostFriendBow"),
    whisper("surprise", "whispers.costume.surprise"),
  ],
  sceneWhispers: [
    whisper("candle-window", "whispers.scene.candleWindow"),
    whisper("snowy-garden", "whispers.scene.snowyGarden", LIVING),
    whisper("attic-glow", "whispers.scene.atticGlow"),
    whisper("quiet-tree", "whispers.scene.quietTree", PASSED),
  ],
  vibeWhispers: [
    whisper("christmas-cozy", "whispers.vibe.christmasCozy"),
    whisper("wonder-soft", "whispers.vibe.wonderSoft"),
    whisper("gentle-warm", "whispers.vibe.gentleWarm", PASSED),
  ],
});

const CHRISTMAS_SANTA_WORKSHOP_THEME = withSharedIdentity({
  id: "christmas-santa-workshop",
  costumes: [
    option("workshop-apron", "🧤", "options.costumes.workshopApron"),
    option("tiny-santa-hat", "🎅", "options.costumes.tinySantaHat"),
    option("gift-ribbon", "🎁", "options.costumes.giftRibbon"),
    option("mitten-set", "🧤", "options.costumes.mittenSet"),
    option("surprise", "✨", "options.costumes.surprise"),
  ],
  scenes: [
    option("toy-workbench", "🪵", "options.scenes.toyWorkbench"),
    option("wrapping-table", "🎀", "options.scenes.wrappingTable", LIVING),
    option("workshop-loft", "🪜", "options.scenes.workshopLoft"),
    option("quiet-workshop", "🕯️", "options.scenes.quietWorkshop", PASSED),
  ],
  vibes: [
    option("busy-warm", "🍪", "options.vibes.busyWarm"),
    option("cinnamon-soft", "☕", "options.vibes.cinnamonSoft"),
    option("gentle-warm", "🕯️", "options.vibes.gentleWarm", PASSED),
  ],
  costumeWhispers: [
    whisper("workshop-apron", "whispers.costume.workshopApron"),
    whisper("tiny-santa-hat", "whispers.costume.tinySantaHat"),
    whisper("gift-ribbon", "whispers.costume.giftRibbon"),
    whisper("mitten-set", "whispers.costume.mittenSet"),
    whisper("surprise", "whispers.costume.surprise"),
  ],
  sceneWhispers: [
    whisper("toy-workbench", "whispers.scene.toyWorkbench"),
    whisper("wrapping-table", "whispers.scene.wrappingTable", LIVING),
    whisper("workshop-loft", "whispers.scene.workshopLoft"),
    whisper("quiet-workshop", "whispers.scene.quietWorkshop", PASSED),
  ],
  vibeWhispers: [
    whisper("busy-warm", "whispers.vibe.busyWarm"),
    whisper("cinnamon-soft", "whispers.vibe.cinnamonSoft"),
    whisper("gentle-warm", "whispers.vibe.gentleWarm", PASSED),
  ],
});

const CHRISTMAS_FIRST_SNOW_POST_THEME = withSharedIdentity({
  id: "christmas-first-snow-post",
  costumes: [
    option("post-bag", "✉️", "options.costumes.postBag"),
    option("wool-coat", "🧥", "options.costumes.woolCoat"),
    option("letter-ribbon", "💌", "options.costumes.letterRibbon"),
    option("earmuffs", "🎧", "options.costumes.earmuffs"),
    option("surprise", "✨", "options.costumes.surprise"),
  ],
  scenes: [
    option("snow-post-office", "🏤", "options.scenes.snowPostOffice"),
    option("letter-path", "🛤️", "options.scenes.letterPath", LIVING),
    option("frost-window", "🪟", "options.scenes.frostWindow"),
    option("quiet-mailbox", "📫", "options.scenes.quietMailbox", PASSED),
  ],
  vibes: [
    option("winter-walk", "❄️", "options.vibes.winterWalk"),
    option("letter-warm", "✉️", "options.vibes.letterWarm"),
    option("gentle-warm", "🕯️", "options.vibes.gentleWarm", PASSED),
  ],
  costumeWhispers: [
    whisper("post-bag", "whispers.costume.postBag"),
    whisper("wool-coat", "whispers.costume.woolCoat"),
    whisper("letter-ribbon", "whispers.costume.letterRibbon"),
    whisper("earmuffs", "whispers.costume.earmuffs"),
    whisper("surprise", "whispers.costume.surprise"),
  ],
  sceneWhispers: [
    whisper("snow-post-office", "whispers.scene.snowPostOffice"),
    whisper("letter-path", "whispers.scene.letterPath", LIVING),
    whisper("frost-window", "whispers.scene.frostWindow"),
    whisper("quiet-mailbox", "whispers.scene.quietMailbox", PASSED),
  ],
  vibeWhispers: [
    whisper("winter-walk", "whispers.vibe.winterWalk"),
    whisper("letter-warm", "whispers.vibe.letterWarm"),
    whisper("gentle-warm", "whispers.vibe.gentleWarm", PASSED),
  ],
});

const CHRISTMAS_SNOW_GLOBE_THEME = withSharedIdentity({
  id: "christmas-snow-globe",
  costumes: [
    option("snow-globe-bow", "🎀", "options.costumes.snowGlobeBow"),
    option("tiny-coat", "🧥", "options.costumes.tinyCoat"),
    option("sparkle-scarf", "✨", "options.costumes.sparkleScarf"),
    option("surprise", "✨", "options.costumes.surprise"),
  ],
  scenes: [
    option("inside-snow-globe", "🔮", "options.scenes.insideSnowGlobe"),
    option("village-in-glass", "🏘️", "options.scenes.villageInGlass", LIVING),
    option("quiet-globe", "❄️", "options.scenes.quietGlobe", PASSED),
  ],
  vibes: [
    option("tiny-world", "🫧", "options.vibes.tinyWorld"),
    option("hush-glow", "🌟", "options.vibes.hushGlow"),
    option("gentle-warm", "🕯️", "options.vibes.gentleWarm", PASSED),
  ],
  costumeWhispers: [
    whisper("snow-globe-bow", "whispers.costume.snowGlobeBow"),
    whisper("tiny-coat", "whispers.costume.tinyCoat"),
    whisper("sparkle-scarf", "whispers.costume.sparkleScarf"),
    whisper("surprise", "whispers.costume.surprise"),
  ],
  sceneWhispers: [
    whisper("inside-snow-globe", "whispers.scene.insideSnowGlobe"),
    whisper("village-in-glass", "whispers.scene.villageInGlass", LIVING),
    whisper("quiet-globe", "whispers.scene.quietGlobe", PASSED),
  ],
  vibeWhispers: [
    whisper("tiny-world", "whispers.vibe.tinyWorld"),
    whisper("hush-glow", "whispers.vibe.hushGlow"),
    whisper("gentle-warm", "whispers.vibe.gentleWarm", PASSED),
  ],
});

export const POLAROID_THEMES: Record<PolaroidThemeId, SeasonalPolaroidTheme> = {
  halloween: HALLOWEEN_POLAROID_THEME,
  "felt-doll": FELT_DOLL_THEME,
  "gouache-story": GOUACHE_STORY_THEME,
  "paper-collage": PAPER_COLLAGE_THEME,
  "starlight-oil": STARLIGHT_OIL_THEME,
  "miniature-world": MINIATURE_WORLD_THEME,
  "crayon-diary": CRAYON_DIARY_THEME,
  "christmas-little-ghost": CHRISTMAS_LITTLE_GHOST_THEME,
  "christmas-santa-workshop": CHRISTMAS_SANTA_WORKSHOP_THEME,
  "christmas-first-snow-post": CHRISTMAS_FIRST_SNOW_POST_THEME,
  "christmas-snow-globe": CHRISTMAS_SNOW_GLOBE_THEME,
};

export const POLAROID_THEME_IDS = Object.keys(POLAROID_THEMES) as PolaroidThemeId[];

export const POLAROID_SURPRISE_COSTUMES: Record<PolaroidThemeId, { living: readonly string[]; passed: readonly string[] }> = {
  halloween: {
    living: ["vampire", "witch", "pumpkin", "bat-wings", "wizard"],
    passed: ["vampire", "witch", "pumpkin", "bat-wings", "wizard", "little-angel"],
  },
  "felt-doll": {
    living: ["knit-scarf", "tiny-cardigan", "felt-bow", "wool-hat", "felt-plain"],
    passed: ["knit-scarf", "tiny-cardigan", "felt-bow", "wool-hat", "felt-plain"],
  },
  "gouache-story": {
    living: ["picture-cape", "flower-crown", "rain-boots", "picnic-ribbon"],
    passed: ["picture-cape", "flower-crown", "rain-boots", "picnic-ribbon"],
  },
  "paper-collage": {
    living: ["paper-crown", "folded-cape", "button-bow", "leaf-collar"],
    passed: ["paper-crown", "folded-cape", "button-bow", "leaf-collar"],
  },
  "starlight-oil": {
    living: ["midnight-scarf", "star-ribbon", "painter-collar", "lantern-charm"],
    passed: ["midnight-scarf", "star-ribbon", "painter-collar", "lantern-charm", "little-angel"],
  },
  "miniature-world": {
    living: ["tiny-coat", "diorama-hat", "scale-scarf"],
    passed: ["tiny-coat", "diorama-hat", "scale-scarf"],
  },
  "crayon-diary": {
    living: ["crayon-bow", "scribble-cape", "notebook-sticker"],
    passed: ["crayon-bow", "scribble-cape", "notebook-sticker"],
  },
  "christmas-little-ghost": {
    living: ["tiny-bell-collar", "knit-cape", "snow-scarf", "ghost-friend-bow"],
    passed: ["tiny-bell-collar", "knit-cape", "snow-scarf", "ghost-friend-bow"],
  },
  "christmas-santa-workshop": {
    living: ["workshop-apron", "tiny-santa-hat", "gift-ribbon", "mitten-set"],
    passed: ["workshop-apron", "tiny-santa-hat", "gift-ribbon", "mitten-set"],
  },
  "christmas-first-snow-post": {
    living: ["post-bag", "wool-coat", "letter-ribbon", "earmuffs"],
    passed: ["post-bag", "wool-coat", "letter-ribbon", "earmuffs"],
  },
  "christmas-snow-globe": {
    living: ["snow-globe-bow", "tiny-coat", "sparkle-scarf"],
    passed: ["snow-globe-bow", "tiny-coat", "sparkle-scarf"],
  },
};

export function polaroidThemeById(themeId: string): SeasonalPolaroidTheme | undefined {
  return isPolaroidThemeId(themeId) ? POLAROID_THEMES[themeId] : undefined;
}
