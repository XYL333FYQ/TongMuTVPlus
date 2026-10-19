export interface DetailData {
  title: string;
  originalTitle?: string;
  backdrop?: string;
  year?: string;
  poster?: string;
  rating?: {
    value: number;
    count: number;
  };
  intro?: string;
  genres?: string[];
  directors?: Array<{ name: string; profile_path?: string }>;
  actors?: Array<{ name: string; character?: string; profile_path?: string }>;
  countries?: string[];
  languages?: string[];
  duration?: string;
  episodesCount?: number;
  releaseDate?: string;
  status?: string;
  tagline?: string;
  seasons?: number;
  overview?: string;
  tmdbId?: number;
  mediaType?: 'movie' | 'tv';
  seasonNumber?: number;
  seriesTitle?: string;
}

export interface Episode {
  id: number;
  name: string;
  episode_number: number;
  still_path: string | null;
  overview: string;
  air_date: string;
}

export interface GalleryImage {
  file_path: string;
  width: number;
  height: number;
  vote_average?: number;
  vote_count?: number;
  iso_639_1?: string | null;
  imageType: 'backdrop' | 'poster';
}
