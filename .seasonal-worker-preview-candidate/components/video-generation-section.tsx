"use client";

import { PetPhotoUpload } from "@/components/pet-photo-upload";
import { VideoMotionPicker } from "@/components/video-motion-picker";
import type { VideoMotion } from "@/lib/survey";

/** 영상 생성 UI — 사진·모션 선택. API 연동은 추후 개발자가 `petPhoto` + `videoMotion`으로 처리 */
export type VideoGenerationDraft = {
  petPhoto: File | null;
  videoMotion: VideoMotion | "";
};

type VideoGenerationSectionProps = {
  petDisplayName: string;
  petPhotoPreviewUrl: string | null;
  petPhoto: File | null;
  onPetPhotoChange: (file: File | null) => void;
  videoMotion: VideoMotion | "";
  onVideoMotionChange: (motion: VideoMotion) => void;
};

export function VideoGenerationSection({
  petDisplayName,
  petPhotoPreviewUrl,
  petPhoto,
  onPetPhotoChange,
  videoMotion,
  onVideoMotionChange,
}: VideoGenerationSectionProps) {
  const hasPhoto = petPhoto != null && petPhotoPreviewUrl != null;

  return (
    <section className="mx-auto mt-8 max-w-xl space-y-0">
      <div className="rounded-2xl border border-[rgba(212,175,55,0.22)] bg-[rgba(12,10,8,0.55)] px-5 py-6 sm:px-7">
        <PetPhotoUpload
          petDisplayName={petDisplayName}
          previewUrl={petPhotoPreviewUrl}
          onFileChange={onPetPhotoChange}
        />
      </div>

      <VideoMotionPicker
        petDisplayName={petDisplayName}
        value={videoMotion}
        onChange={onVideoMotionChange}
        disabled={!hasPhoto}
      />
    </section>
  );
}
