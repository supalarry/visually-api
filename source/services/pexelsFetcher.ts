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
        logging.info(NAMESPACE, `Fetching video ${query}`);
        const videos: Videos | ErrorResponse = await client.videos.search({ query, per_page: 10 });
        if (!(videos as ErrorResponse).error) {
            video = (videos as Videos).videos;
            return video;
        } else {
            throw new Error((videos as ErrorResponse).error);
        }
    } catch (error) {
        logging.error(NAMESPACE, `Failed fetching video "${query}"`);
        logging.error(NAMESPACE, `Fetching failure reason: ${error.message}`, error);
        throw new Error(error.message);
    }
}

async function fetchVideos(transcription: Transcription) {
    logging.info(NAMESPACE, 'Start fetching videos');
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
            // check how many videos to include based on sentence duration
            let selectedVideoDuration = 0;
            for (let video of fetchedVideos) {
                if (selectedVideoDuration < sentence.duration) {
                    selectedVideos.push(video);
                    selectedVideoDuration += video.duration;
                } else {
                    // trim last video to match sentence length
                    selectedVideos[selectedVideos.length - 1].duration -= selectedVideoDuration - sentence.duration;
                    break;
                }
            }
            // note the selected item for which videos were fetched
            sentence.selectedForVideo = sentence.relevanceRank?.[relevanceRank];
        } while (!selectedVideos.length);

        sentence.videos = selectedVideos;
    }
    logging.info(NAMESPACE, 'Finished fetching videos');
}

export { fetchVideos };
