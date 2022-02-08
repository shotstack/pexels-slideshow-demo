'use strict';

const request = require('request');
const Joi = require('@hapi/joi');
const pexels = require('pexels');
const shotstackUrl = process.env.SHOTSTACK_HOST;
const shotstackApiKey = process.env.SHOTSTACK_API_KEY;

const SOUNDTRACKS = {
    palmtrees: "https://feeds.soundcloud.com/stream/499015833-unminus-palmtrees.mp3",
    ambisax: "https://feeds.soundcloud.com/stream/573901050-unminus-ambisax.mp3",
    lit: "https://feeds.soundcloud.com/stream/554074383-unminus-lit.mp3"
}

const LUMA_ASSETS = [
    "https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/luma-mattes/brush-strokes/brush-strokes-left-fast.mp4",
    "https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/luma-mattes/brush-strokes/brush-strokes-right-fast.mp4",
    "https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/luma-mattes/brush-strokes/brush-strokes-left-flip-fast.mp4",
    "https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/luma-mattes/brush-strokes/brush-strokes-right-flip-fast.mp4",
];

const EFFECTS = [
    "zoomInSlow", "slideUpSlow", "slideLeftSlow", "zoomOutSlow", "slideDownSlow", "slideRightSlow"
]

const pexelsClient = pexels.createClient(process.env.PEXELS_API_KEY);

module.exports.submit = (data) => {
    const schema = {
        search: Joi.string().regex(/^[a-zA-Z0-9 ]*$/).min(2).max(20).required(),
        title: Joi.string().regex(/^[a-zA-Z0-9 ]*$/).min(2).max(30).required(),
        soundtrack: Joi.string().valid(['disco', 'freeflow', 'melodic', 'lit', 'ambisax', 'palmtrees']).required(),
    };

    const valid = Joi.validate({
        search: data.search,
        soundtrack: data.soundtrack,
        title: data.title
    }, schema);

   
    return new Promise((resolve, reject) => {
        if (valid.error) {
            return reject(valid.error);
        }

        const maxResults = 20;
        const minClips = 4;
        const maxClips = 8;
        const clipLength = 7;
        const lumaLength = 2;
        const titleLength = 6;
        
        pexelsClient.photos.search({query: data.search, per_page: maxResults, orientation:'landscape'}).then(response => {
            if (response.total_results < minClips) {
                throw "There are not enough images for '" + data.search + "' to create a video";
            }
            
            const images = [];
            for (let i=0; i < maxClips; i++) {
                const randomIndex = Math.floor(Math.random() * response.photos.length);
                images.push(response.photos[randomIndex]);
                response.photos.splice(randomIndex, 1);
            }

            const tracks = [];
            
            const title = {
                clips: [
                    {
                        asset: {
                            type: "title",
                            text: data.title.toUpperCase(),
                            style: "chunk",
                            size: "x-large"
                        },
                        start: 0,
                        length: titleLength,
                        transition: {
                            in: "slideUp",
                            out: "slideDown"
                        }
                    }
                ]
            };

            tracks.push(title);
                
            images.forEach((image, index) => {
                const imageSrc = image.src.original;
                const isFirstClip = index === 0;
                const isLastClip = index === (maxClips - 1);
                const newClipStartTime = (index * clipLength) - index * lumaLength;
                const imageAsset = {
                    asset: {
                        type: "image",
                        src: imageSrc
                    },
                    start: newClipStartTime,
                    length: clipLength,
                    effect: EFFECTS[index % EFFECTS.length]
                }
                const clips = [imageAsset];

                if (isFirstClip) {
                    imageAsset.transition = {
                        in: "fade"
                    }
                }

                if (isLastClip) {   
                    imageAsset.length = clipLength - lumaLength;       
                    imageAsset.transition = {
                        out: "fade"
                    }
                }
                else {
                    const lumaAsset =  {
                        asset: {
                            type: "luma",
                            src: LUMA_ASSETS[index % LUMA_ASSETS.length],
                        },
                        start: newClipStartTime + clipLength - lumaLength,
                        length: lumaLength
                    }
                    clips.push(lumaAsset);
                }
                
                tracks.push({clips});
            })

            const timeline = {
                soundtrack: {
                    src: SOUNDTRACKS[data.soundtrack],
                    effect: "fadeOut"
                },
                background: "#000000",
                tracks: tracks,
            };

            let output = {
                format: "mp4",
                resolution: "sd"
            };

            let edit = {
                timeline: timeline,
                output: output
            };

            request({
                url: shotstackUrl + 'render',
                method: 'POST',
                headers: {
                    'x-api-key': shotstackApiKey
                },
                json: true,
                body: edit
            }, function (error, response, body){
                if (error) {
                    console.log(error);
                    return reject(error);
                }

                return resolve(body.response);
            });
        }).catch(function(error) {
            console.log(error);
            return reject(error);
        });
    });
};

module.exports.status = (id) => {
    const schema = {
        id: Joi.string().guid({
            version: [
                'uuidv4',
                'uuidv5'
            ]
        })
    };

    const valid = Joi.validate({
        id: id
    }, schema);

    return new Promise((resolve, reject) => {
        if (valid.error) {
            return reject(valid.error);
        }

        request({
            url: shotstackUrl + 'render/' + id,
            method: 'GET',
            headers: {
                'x-api-key': shotstackApiKey
            },
            json: true
        }, function (error, response, body) {
            if (error) {
                console.log(error);
                return reject(error);
            }

            return resolve(body.response);
        });
    });
};
