export type PolaroidStatus = "living" | "passed";
export type PolaroidSpecies = "dog" | "cat" | "rabbit" | "hamster" | "bird" | "other";

export type SeasonalOption = {
  id: string;
  emoji: string;
  labelKey: string;
  only?: readonly PolaroidStatus[];
};

export type WhisperRule = {
  key: string;
  id: string;
  only?: readonly PolaroidStatus[];
};

export type SeasonalPolaroidTheme = {
  id: string;
  costumes: readonly SeasonalOption[];
  scenes: readonly SeasonalOption[];
  vibes: readonly SeasonalOption[];
  personalities: readonly SeasonalOption[];
  habitsBySpecies: Record<PolaroidSpecies, readonly SeasonalOption[]>;
  treatsBySpecies: Record<PolaroidSpecies, readonly SeasonalOption[]>;
  callNames: readonly SeasonalOption[];
  whispers: {
    default: WhisperRule;
    photo: WhisperRule;
    costume: readonly WhisperRule[];
    scene: readonly WhisperRule[];
    vibe: readonly WhisperRule[];
    personality: readonly WhisperRule[];
    habit: WhisperRule;
    treat: WhisperRule;
    callName: WhisperRule;
  };
};

const LIVING: readonly PolaroidStatus[] = ["living"];
const PASSED: readonly PolaroidStatus[] = ["passed"];

const option = (id: string, emoji: string, labelKey: string, only?: readonly PolaroidStatus[]): SeasonalOption => ({
  id,
  emoji,
  labelKey,
  ...(only ? { only } : {}),
});

const dogHabits = [
  option("toy-carrier", "🧸", "options.habits.dog.toyCarrier"),
  option("head-tilt", "🐶", "options.habits.dog.headTilt"),
  option("whole-body-wiggle", "💃", "options.habits.dog.wholeBodyWiggle"),
  option("doorway-watcher", "🚪", "options.habits.dog.doorwayWatcher"),
] as const;

const catHabits = [
  option("sunbeam-napper", "☀️", "options.habits.cat.sunbeamNapper"),
  option("midnight-zoomies", "🌙", "options.habits.cat.midnightZoomies"),
  option("box-inspector", "📦", "options.habits.cat.boxInspector"),
  option("tiny-judge", "😼", "options.habits.cat.tinyJudge"),
] as const;

const rabbitHabits = [
  option("binky", "🐇", "options.habits.rabbit.binky"),
  option("nose-boop", "👃", "options.habits.rabbit.noseBoop"),
  option("hay-rearranger", "🌾", "options.habits.rabbit.hayRearranger"),
  option("happy-flop", "🛋️", "options.habits.rabbit.happyFlop"),
] as const;

const hamsterHabits = [
  option("wheel-runner", "🎡", "options.habits.hamster.wheelRunner"),
  option("cheek-stuffer", "🥜", "options.habits.hamster.cheekStuffer"),
  option("tiny-burrower", "🕳️", "options.habits.hamster.tinyBurrower"),
  option("night-explorer", "🔦", "options.habits.hamster.nightExplorer"),
] as const;

const birdHabits = [
  option("morning-singer", "🎶", "options.habits.bird.morningSinger"),
  option("head-cock", "🐦", "options.habits.bird.headCock"),
  option("shiny-thief", "✨", "options.habits.bird.shinyThief"),
  option("shoulder-perch", "🪶", "options.habits.bird.shoulderPerch"),
] as const;

const otherHabits = [
  option("favorite-routine", "💛", "options.habits.other.favoriteRoutine"),
  option("curious-explorer", "🔎", "options.habits.other.curiousExplorer"),
  option("snack-seeker", "🍪", "options.habits.other.snackSeeker"),
  option("cozy-cuddler", "🫶", "options.habits.other.cozyCuddler"),
] as const;

export const HALLOWEEN_POLAROID_THEME: SeasonalPolaroidTheme = {
  id: "halloween",
  costumes: [
    option("vampire", "🧛", "options.costumes.vampire"),
    option("witch", "🧙", "options.costumes.witch"),
    option("pumpkin", "🎃", "options.costumes.pumpkin"),
    option("bat-wings", "🦇", "options.costumes.batWings"),
    option("wizard", "🪄", "options.costumes.wizard"),
    option("ghost-sheet", "👻", "options.costumes.ghostSheet", LIVING),
    option("skeleton", "💀", "options.costumes.skeleton", LIVING),
    option("little-angel", "😇", "options.costumes.littleAngel", PASSED),
    option("surprise", "✨", "options.costumes.surprise"),
  ],
  scenes: [
    option("pumpkin-patch", "🎃", "options.scenes.pumpkinPatch"),
    option("candy-room", "🍬", "options.scenes.candyRoom"),
    option("moonlit-forest", "🌙", "options.scenes.moonlitForest"),
    option("trick-or-treat-street", "👜", "options.scenes.trickOrTreatStreet", LIVING),
    option("haunted-porch", "🏚️", "options.scenes.hauntedPorch", LIVING),
    option("lantern-meadow", "🏮", "options.scenes.lanternMeadow", PASSED),
  ],
  vibes: [
    option("cute-cozy", "🧡", "options.vibes.cuteCozy"),
    option("silly-chaotic", "🤪", "options.vibes.sillyChaotic"),
    option("spooky-cool", "🕸️", "options.vibes.spookyCool", LIVING),
    option("gentle-warm", "🕯️", "options.vibes.gentleWarm", PASSED),
  ],
  personalities: [
    option("foodie", "🍖", "options.personalities.foodie"),
    option("drama", "🎭", "options.personalities.drama"),
    option("scaredy-cat", "🙀", "options.personalities.scaredyCat"),
    option("zoomies", "💨", "options.personalities.zoomies"),
    option("cuddle-bug", "🤗", "options.personalities.cuddleBug"),
    option("little-boss", "👑", "options.personalities.littleBoss"),
    option("sleepyhead", "😴", "options.personalities.sleepyhead"),
    option("curious-explorer", "🔎", "options.personalities.curiousExplorer"),
  ],
  habitsBySpecies: {
    dog: dogHabits,
    cat: catHabits,
    rabbit: rabbitHabits,
    hamster: hamsterHabits,
    bird: birdHabits,
    other: otherHabits,
  },
  treatsBySpecies: {
    dog: [
      option("pumpkin-biscuit", "🎃", "options.treats.dog.pumpkinBiscuit"),
      option("jerky", "🥓", "options.treats.dog.jerky"),
      option("cheese", "🧀", "options.treats.dog.cheese"),
      option("custom", "✍️", "options.treats.custom"),
    ],
    cat: [
      option("tuna", "🐟", "options.treats.cat.tuna"),
      option("churu", "🍥", "options.treats.cat.churu"),
      option("catnip", "🌿", "options.treats.cat.catnip"),
      option("custom", "✍️", "options.treats.custom"),
    ],
    rabbit: [
      option("carrot", "🥕", "options.treats.rabbit.carrot"),
      option("apple", "🍎", "options.treats.rabbit.apple"),
      option("fresh-greens", "🥬", "options.treats.rabbit.freshGreens"),
      option("custom", "✍️", "options.treats.custom"),
    ],
    hamster: [
      option("sunflower-seed", "🌻", "options.treats.hamster.sunflowerSeed"),
      option("tiny-fruit", "🍓", "options.treats.hamster.tinyFruit"),
      option("crunchy-treat", "🌰", "options.treats.hamster.crunchyTreat"),
      option("custom", "✍️", "options.treats.custom"),
    ],
    bird: [
      option("millet", "🌾", "options.treats.bird.millet"),
      option("berries", "🫐", "options.treats.bird.berries"),
      option("sunflower-seed", "🌻", "options.treats.bird.sunflowerSeed"),
      option("custom", "✍️", "options.treats.custom"),
    ],
    other: [
      option("favorite-snack", "🍪", "options.treats.other.favoriteSnack"),
      option("special-bite", "✨", "options.treats.other.specialBite"),
      option("custom", "✍️", "options.treats.custom"),
    ],
  },
  callNames: [
    option("mom", "💛", "options.callNames.mom"),
    option("dad", "💛", "options.callNames.dad"),
    option("both", "💛", "options.callNames.both"),
    option("sister", "🌼", "options.callNames.sister"),
    option("brother", "🌼", "options.callNames.brother"),
    option("by-name", "✍️", "options.callNames.byName"),
    option("custom", "✨", "options.callNames.custom"),
  ],
  whispers: {
    default: { id: "default", key: "whispers.default" },
    photo: { id: "photo", key: "whispers.photo" },
    costume: [
      { id: "vampire", key: "whispers.costume.vampire" },
      { id: "witch", key: "whispers.costume.witch" },
      { id: "pumpkin", key: "whispers.costume.pumpkin" },
      { id: "bat-wings", key: "whispers.costume.batWings" },
      { id: "wizard", key: "whispers.costume.wizard" },
      { id: "ghost-sheet", key: "whispers.costume.ghostSheet", only: LIVING },
      { id: "skeleton", key: "whispers.costume.skeleton", only: LIVING },
      { id: "little-angel", key: "whispers.costume.littleAngel", only: PASSED },
      { id: "surprise", key: "whispers.costume.surprise" },
    ],
    scene: [
      { id: "pumpkin-patch", key: "whispers.scene.pumpkinPatch" },
      { id: "candy-room", key: "whispers.scene.candyRoom" },
      { id: "moonlit-forest", key: "whispers.scene.moonlitForest" },
      { id: "trick-or-treat-street", key: "whispers.scene.trickOrTreatStreet", only: LIVING },
      { id: "haunted-porch", key: "whispers.scene.hauntedPorch", only: LIVING },
      { id: "lantern-meadow", key: "whispers.scene.lanternMeadow", only: PASSED },
    ],
    vibe: [
      { id: "cute-cozy", key: "whispers.vibe.cuteCozy" },
      { id: "silly-chaotic", key: "whispers.vibe.sillyChaotic" },
      { id: "spooky-cool", key: "whispers.vibe.spookyCool", only: LIVING },
      { id: "gentle-warm", key: "whispers.vibe.gentleWarm", only: PASSED },
    ],
    personality: [
      { id: "foodie", key: "whispers.personality.foodie" },
      { id: "drama", key: "whispers.personality.drama" },
      { id: "scaredy-cat", key: "whispers.personality.scaredyCat" },
      { id: "zoomies", key: "whispers.personality.zoomies" },
      { id: "cuddle-bug", key: "whispers.personality.cuddleBug" },
      { id: "little-boss", key: "whispers.personality.littleBoss" },
      { id: "sleepyhead", key: "whispers.personality.sleepyhead" },
      { id: "curious-explorer", key: "whispers.personality.curiousExplorer" },
    ],
    habit: { id: "habit", key: "whispers.habit" },
    treat: { id: "treat", key: "whispers.treat" },
    callName: { id: "call-name", key: "whispers.callName" },
  },
};

export function optionsForStatus(
  options: readonly SeasonalOption[],
  status: PolaroidStatus | "",
): readonly SeasonalOption[] {
  return options.filter((item) => !item.only || (status && item.only.includes(status)));
}

export function optionById(
  options: readonly SeasonalOption[],
  id: string,
): SeasonalOption | undefined {
  return options.find((item) => item.id === id);
}

export function whisperFor(
  rules: readonly WhisperRule[],
  id: string,
  status: PolaroidStatus,
): WhisperRule | undefined {
  return rules.find((rule) => rule.id === id && (!rule.only || rule.only.includes(status)));
}
