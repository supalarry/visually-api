import { createClient, Videos, Video, ErrorResponse } from 'pexels';
import { Transcription } from '../services/watson';
import logging from '../config/logging';
const client = createClient(process.env.PEXELS_API_KEY!);

const NAMESPACE = 'pexelsFetcher';
const NO_VIDEOS_FOUND = 'No videos found';

// async function fetchMultipleVideos(searchTerms: string[]): Promise<Video[]> {
//     logging.info(NAMESPACE, 'Fetching videos');
//     let videos: Video[] = [];
//     for (let searchTerm of searchTerms) {
//         const video = await fetchVideo(searchTerm);
//         if (video) {
//             videos.push(video);
//         }
//     }
//     if (!videos.length) {
//         throw new Error(NO_VIDEOS_FOUND);
//     }
//     return videos;
// }

async function fetchVideosForSearchTerm(query: string | undefined): Promise<Video[]> {
    let video: Video[];
    if (!query) {
        logging.error(NAMESPACE, `Fetching falsey value to fetchVideo is not allowed`);
        throw new Error('Fetching falsey value to fetchVideo is not allowed');
    }
    try {
        const videos: Videos | ErrorResponse = await client.videos.search({ query, per_page: 1 });
        if (!(videos as ErrorResponse).error) {
            video = (videos as Videos).videos;
            return video;
        } else {
            logging.error(NAMESPACE, `Failed fetching video ${query}`);
            throw new Error((videos as ErrorResponse).error);
        }
    } catch (error) {
        logging.error(NAMESPACE, `Failed fetching video ${query}`);
        throw new Error(error.message);
    }
}

async function fetchVideos(transcription: Transcription) {
    for (let sentence of transcription.sentences) {
        const selectedVideos: Video[] = [];
        let relevanceRank = 0;
        do {
            const fetchedVideos = await fetchVideosForSearchTerm(sentence.relevanceRank?.[relevanceRank].text);
            // check if search term returned any videos
            if (!fetchVideos.length) {
                // if not, fetch again
                relevanceRank += 1;
                continue;
            }
            relevanceRank = 0;
            // check how many videos to include based on sentence length
            let count = 0;
            let selectedVideoDuration = 0;
            for (let video of fetchedVideos) {
                if (selectedVideoDuration < sentence.duration) {
                    count += 1;
                    selectedVideoDuration += video.duration;
                } else {
                    break;
                }
            }
            // select videos for the sentence
            // TODO: you can just do this within the previous for let loop
            let i = 0;
            while (i < count) {
                selectedVideos.push(fetchedVideos[i]);
                i += 1;
            }
            // remove time from last video to match sentence length
            selectedVideos[selectedVideos.length - 1].duration -= selectedVideoDuration - sentence.duration;
            // note the selected item for which videos were fetched
            sentence.selectedForVideo = sentence.relevanceRank?.[relevanceRank];
        } while (!selectedVideos.length);

        sentence.videos = selectedVideos;
    }
}

export { fetchVideos };
