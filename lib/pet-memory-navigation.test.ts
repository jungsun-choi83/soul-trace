import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("My Pets opens a pet profile and keeps profile details separate from the Memories workspace", () => {
  const petRoute = read("app/my/pets/[petId]/page.tsx");
  const roster = read("components/pet-roster.tsx");
  const profile = read("components/pet-first-profile.tsx");

  assert.match(roster, /href=\{`\/my\/pets\/\$\{pet\.petId\}`\}/);
  assert.match(roster, /href=\{`\/my\/pets\/\$\{active\.petId\}`\}/);
  assert.match(petRoute, /PetFirstProfile/);
  assert.doesNotMatch(petRoute, /PetFirstMemory/);
  for (const expected of ["profile.petName", "profile.birthday", "profile.adoptedOn", "daysTogether", "copy.statMemories", "copy.statPhotos", "copy.statLetters", "copy.editPet", "beamSceneHref", "summary?.coverUrl"]) {
    assert.ok(profile.includes(expected), `profile should retain ${expected}`);
  }
  assert.match(profile, /StoryTabbar current="pet"/);
  assert.match(profile, /window\.location\.hash === "#album"/);
  assert.match(profile, /window\.location\.hash === "#compose"/);
  assert.match(profile, /\/memories#album/);
  assert.match(profile, /\/memories\/record/);
});

test("the pet Memories route scopes by the selected owner pet and separates Album, Record, and Detail screens", () => {
  const albumRoute = read("app/my/pets/[petId]/memories/page.tsx");
  const recordRoute = read("app/my/pets/[petId]/memories/record/page.tsx");
  const memory = read("components/pet-first-memory.tsx");
  const tabs = read("lib/story-tabs.ts");

  for (const route of [albumRoute, recordRoute]) {
    assert.match(route, /loadPetProfile\(supabase, user\.id, petId\)/);
    assert.match(route, /PetFirstUnavailable/);
  }
  assert.match(albumRoute, /view=\{entryId \? "detail" : "album"\}/);
  assert.match(albumRoute, /returnPane=\{returnPane\}/);
  assert.match(albumRoute, /const folderKey = folderValue/);
  assert.match(albumRoute, /folderKey=\{folderKey\}/);
  assert.match(recordRoute, /view="record"/);
  assert.match(tabs, /\/my\/pets\/\$\{encodeURIComponent\(petId\)\}\/memories#album/);

  assert.match(memory, /groupLibraryIntoYearFolders\(album\)/);
  // The carousel is fed from the real grouping, narrowed by the album scope.
  assert.match(memory, /const scopedMonths = monthFolders\.filter\(/);
  assert.match(memory, /<AlbumFolderBrowser[\s\S]{0,200}months=\{scopedMonths\}/);
  assert.match(memory, /<MonthFolderCarousel[\s\S]{0,60}months=\{months\}/);
  assert.match(memory, /folder\.count/);
  assert.match(memory, /selectedFolder\?\.days\.map/);
  assert.match(memory, /copy\.backToFolders/);
  assert.match(memory, /folder=\$\{selectedFolder\.key\}/);
  assert.match(memory, /href=\{`\$\{albumHref\}\/record`\}/);
  assert.match(memory, /action=\{<Link href=\{`\$\{albumHref\}\/record`\}/);
  assert.match(memory, /router\.push\(`\$\{albumHref\}\?saved=/);
  assert.match(memory, /view === "record"/);
  assert.match(memory, /view === "detail"/);
  assert.match(memory, /letterHrefForPet\(status, petId\)/);
  assert.match(memory, /polaroidHrefFromArchive\(petId, selectedItem\.entryId, selectedItem\.assets\.find/);
  assert.match(memory, /beamSceneHref\(petId/);
  assert.match(memory, /onRemove=\{selectedItem\.deletable/);
  assert.match(memory, /onPatch=\{selectedItem\.deletable/);
  assert.match(memory, /StoryTabbar current="memories"/);
});

test("all four Memories sections stay available and active across screens without losing an edited record silently", () => {
  const memory = read("components/pet-first-memory.tsx");
  const copy = read("lib/storybook-copy.ts");

  for (const section of ["album", "record", "collection", "together"]) {
    assert.match(memory, new RegExp(`id: "${section}"`));
  }
  assert.match(memory, /role="tablist" aria-label=\{copy\.tabs\.memories\}/);
  assert.match(memory, /aria-selected=\{currentSection === tab\.id\}/);
  assert.match(memory, /aria-current=\{currentSection === tab\.id \? "page" : undefined\}/);
  assert.match(memory, /onClickCapture=\{confirmUnsavedRecordNavigation\}/);
  assert.match(memory, /recordDirty\.current = true/);
  assert.match(memory, /window\.confirm\(copy\.unsavedRecordConfirm\)/);
  assert.match(memory, /function changeComposeMode\(nextMode: ComposeMode\)/);
  assert.doesNotMatch(memory, /className="st-link mt-3 inline-flex min-h-11 items-center text-sm">\{copy\.albumTitle\}/);
  assert.match(copy, /unsavedRecordConfirm: "저장하지 않은 내용이 있어요/);
  assert.match(copy, /unsavedRecordConfirm: "You have unsaved changes/);
});

test("the Album uses real month-folder data in an accessible responsive carousel without the monthly progress section", () => {
  const memory = read("components/pet-first-memory.tsx");

  assert.match(memory, /groupLibraryIntoYearFolders\(album\)/);
  assert.match(memory, /flattenYearFoldersNewestFirst\(yearFolders\)/);
  // The carousel is fed from the real grouping, narrowed by the album scope.
  assert.match(memory, /const scopedMonths = monthFolders\.filter\(/);
  assert.match(memory, /<AlbumFolderBrowser[\s\S]{0,200}months=\{scopedMonths\}/);
  assert.match(memory, /<MonthFolderCarousel[\s\S]{0,60}months=\{months\}/);
  assert.match(memory, /monthFolderCoverUrl\(folder\)/);
  assert.match(memory, /w-\[calc\(100vw-2rem\)\].*max-w-5xl/);
  // Shape, not exact values: the cards overlap into a fan, the centred folder
  // is enlarged, and each card carries a folder tab above its photo pocket.
  assert.match(memory, /-ml-\d+/);
  assert.match(memory, /scale-\[1\.\d+\]/);
  assert.match(memory, /absolute left-\d+ top-\d+ [^"]*rounded-t-/);
  assert.match(memory, /bg-\[#fffaf0\]\/90/);
  // The month and count sit on the cover photo itself.
  assert.match(memory, /monthShortLabel\(folder\.key, lang\)/);
  assert.match(memory, /folderMemoryCount\(lang, folder\.count\)/);
  assert.match(memory, /href=\{`\$\{albumHref\}\?pane=album&folder=\$\{folder\.key\}#album`\}/);
  assert.match(memory, /aria-roledescription="carousel"/);
  assert.match(memory, /overflow-x-auto overscroll-x-contain/);
  assert.match(memory, /snap-x snap-mandatory/);
  assert.match(memory, /onScroll=\{syncActiveFolder\}/);
  assert.match(memory, /moveToFolder\(currentIndex - 1\)/);
  assert.match(memory, /moveToFolder\(currentIndex \+ 1\)/);
  assert.match(memory, /months\.length > 1/);
  assert.match(memory, /aria-label=\{copy\.previousFolder\}/);
  assert.match(memory, /aria-label=\{copy\.nextFolder\}/);
  assert.match(memory, /aria-current=\{isActive \? "true" : undefined\}/);
  assert.match(memory, /disabled=\{currentIndex <= 0\}/);
  assert.match(memory, /disabled=\{currentIndex >= months\.length - 1\}/);
  assert.doesNotMatch(memory, /id="monthly"|MONTHLY_CARD_MIN_ENTRIES|function MonthlyCard/);
  assert.doesNotMatch(memory, /copy\.thisMonth|copy\.monthlyCount|copy\.monthlyLocked|copy\.monthlyCreate|copy\.monthlyTitle/);
  assert.match(memory, /view === "album" && currentSection === "together"/);
  assert.match(memory, /view === "record"/);
  assert.match(memory, /copy\.storyTab/);
  assert.match(memory, /async function saveStory/);
});

test("recording returns to the selected pet album and retains existing photo, video, and story endpoints", () => {
  const memory = read("components/pet-first-memory.tsx");
  const home = read("components/pet-first-home.tsx");

  assert.match(home, /\/my\/pets\/\$\{encodeURIComponent\(active\.petId\)\}\/memories\/record/);
  assert.match(home, /\/my\/pets\/\$\{encodeURIComponent\(created\.petId\)\}\/memories\/record/);
  // The endpoints are what matter here; the transport wrapper may be fetch or
  // the guarded fetchOrNull from lib/network-failure.ts.
  assert.match(memory, /fetch(?:OrNull)?\(`\/api\/my\/pets\/\$\{petId\}\/photos`/);
  assert.match(memory, /fetch(?:OrNull)?\(`\/api\/my\/pets\/\$\{petId\}\/videos`/);
  assert.match(memory, /fetch(?:OrNull)?\(`\/api\/my\/pets\/\$\{petId\}\/memories`/);
  assert.match(memory, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(memory, /accept="video\/mp4,video\/webm,video\/quicktime"/);
  assert.match(memory, /name="story" required maxLength=\{2000\}/);
});

test("photo Record keeps one simple form and resolves EXIF or optional dates before save", () => {
  const memory = read("components/pet-first-memory.tsx");
  const dates = read("lib/photo-capture-date.ts");
  const photoBatch = read("lib/photo-batch.ts");
  const photoApi = read("app/api/my/pets/[petId]/photos/route.ts");
  assert.match(memory, /readOriginalCaptureDate\(file\)/);
  assert.match(memory, /multiple/);
  assert.match(memory, /DateField id="photo-date"/);
  assert.match(memory, /TextLine id="photo-caption"/);
  assert.match(memory, /TextLine id="photo-place"/);
  assert.match(memory, /for \(const date of resolvePhotoBatchDates\(files, detectedDates, optionalDate\)\)/);
  assert.match(memory, /data\.append\("photoDates", date\)/);
  assert.doesNotMatch(memory, /reviewAutoSortingTitle|adjustDates|photoStep|showDateAdjustments/);
  assert.match(photoBatch, /optionalDate \|\| detectedDates\[index\] \|\| ""/);
  assert.match(dates, /DateTimeOriginal/);
  assert.doesNotMatch(dates, /lastModified/);
  assert.match(photoApi, /const submittedDates = form\.getAll\("photoDates"\)/);
  assert.match(photoApi, /const legacyDate = String\(form\.get\("memoryDate"\) \?\? ""\)/);
  assert.match(photoApi, /validatePhotoFiles\(files\.map/);
});
