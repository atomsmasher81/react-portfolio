import { PhotoGallery } from "@/components/v2/photo-gallery";
import { photos } from "@/data/v2/photos";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Photos", description: "Photos and the words that went with them.", path: "/photos" });

export default function PhotosPage() {
    return <PhotoGallery photos={photos} />;
}
