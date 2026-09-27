import { PhotoGallery } from "@/components/v2/photo-gallery";
import { photos } from "@/data/v2/photos";

export const metadata = { title: "Photos", description: "Photos and the words that went with them." };

export default function PhotosPage() {
    return <PhotoGallery photos={photos} />;
}
