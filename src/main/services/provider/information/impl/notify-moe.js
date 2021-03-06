import request from "request-promise"
import InformationProvider from "../information-provider";

const BASE_URL_SEARCH = "https://notify.moe/_/anime-search/";
const BASE_URL_ANIME = "https://notify.moe/api/anime/";
const BASE_URL_IMAGE = "https://media.notify.moe/images/anime";
import rakun from "../../../../utilities";

export default class NotifyMoe extends InformationProvider {
  name() {
    return "Notify.moe";
  }

  seek(title) {
    return new Promise((resolve, reject) => {
      request.get(`${BASE_URL_SEARCH}${encodeURIComponent(title)}`)
        .then(response => {
          let animeIds = (response.match(/href='\/anime\/(\S*)/gi) || []).map(a => {
            return a.replace("href='/anime/", "").replace("'", "");
          });

          let actualTitle = this.extractActualTitle(title);

          let promises = [];

          animeIds.forEach(animeId => {
            promises.push(request.get(`${BASE_URL_ANIME}${animeId}`));
          });

          Promise.all(promises)
            .then(values => {
              let anime, exactTitleMatches = [], estimatedMatches = [];

              values.forEach(response => {
                let responseAnime = JSON.parse(response);

                let actualResponseTitle = this.extractActualTitle(responseAnime.title.canonical);

                if (actualTitle.replaceAll('(TV)', '').trim().toLowerCase() === actualResponseTitle.replaceAll('(TV)', '').trim().toLowerCase()) exactTitleMatches.push(responseAnime);
                else estimatedMatches.push(responseAnime);
              })

              let lowerPriorityAnime = [], higherPriorityAnime = [], primaryPriorityAnime = [];

              if (exactTitleMatches.length) {
                exactTitleMatches.forEach(titleMatchedAnime => {
                  if (Date.now() > Date.parse(titleMatchedAnime.endDate)) lowerPriorityAnime.push(titleMatchedAnime);
                  else if (titleMatchedAnime.type !== 'tv') lowerPriorityAnime.push(titleMatchedAnime);
                  else primaryPriorityAnime.push(titleMatchedAnime);
                })
              } else {
                estimatedMatches.forEach(estimateMatchedAnime => {
                  if (Date.now() > Date.parse(estimateMatchedAnime.endDate)) lowerPriorityAnime.push(estimateMatchedAnime);
                  else if (estimateMatchedAnime.type !== 'tv') lowerPriorityAnime.push(estimateMatchedAnime);
                  else higherPriorityAnime.push(estimateMatchedAnime);
                })
              }

              anime = (primaryPriorityAnime.length ? primaryPriorityAnime : (higherPriorityAnime.length ? higherPriorityAnime : lowerPriorityAnime)).sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate))[0];

              if (!anime) return resolve(null);

              anime.title.primary = anime.title.english.length > 0 ? anime.title.english : anime.title.canonical;

              resolve({
                id: anime.id,
                title: anime.title,
                thumbnail: {
                  small: BASE_URL_IMAGE + "/small/" + anime.id + ".jpg",
                  medium: BASE_URL_IMAGE + "/medium/" + anime.id + ".jpg",
                  large: BASE_URL_IMAGE + "/large/" + anime.id + ".jpg",
                }
              })
            })
        });
    })
  }

  information(id) {
    return new Promise((resolve, reject) => {
      request.get({
        uri: `${BASE_URL_ANIME}/${id}`,
        json: true
      })
        .then(response => {
          response.title.primary = response.title.english.length > 0 ? response.title.english : response.title.canonical;

          resolve({
            airing: {
              start: Date.parse(response.startDate),
              end: Date.parse(response.endDate)
            },
            episode: {
              count: response.episodeCount,
              length: response.episodeLength,
              episodes: response.episodes
            },
            information: {
              title: response.title,
              summary: response.summary,
              source: response.source,
              type: response.type,
              rating: response.rating
            },
          });
        }).catch(error => {
          reject(error);
      })
    })
  }
}
