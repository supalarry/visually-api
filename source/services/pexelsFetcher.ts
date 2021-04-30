import { createClient, Videos, Video, ErrorResponse } from 'pexels';
import logging from '../config/logging';
const client = createClient(process.env.PEXELS_API_KEY!);

const NAMESPACE = 'pexelsFetcher';
const NO_VIDEOS_FOUND = 'No videos found';

async function fetchMultipleVideos(searchTerms: string[]): Promise<Video[]> {
    logging.info(NAMESPACE, 'Fetching videos');
    let videos: Video[] = [];
    for (let searchTerm of searchTerms) {
        const video = await fetchVideo(searchTerm);
        if (video) {
            videos.push(video);
        }
    }
    if (!videos.length) {
        throw new Error(NO_VIDEOS_FOUND);
    }
    return videos;
}

async function fetchVideo(query: string): Promise<Video> {
    let video: Video;
    try {
        const videos: Videos | ErrorResponse = await client.videos.search({ query, per_page: 1 });
        if (!(videos as ErrorResponse).error) {
            video = (videos as Videos).videos[0];
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

export { fetchMultipleVideos };
