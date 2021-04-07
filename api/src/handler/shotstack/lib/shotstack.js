'use strict';

const request = require('request');
const Joi = require('@hapi/joi');
const PexelsAPI = require('pexels-api-wrapper');
const pexels = require('pexels');
const shotstackUrl = process.env.SHOTSTACK_HOST;
const shotstackApiKey = process.env.SHOTSTACK_API_KEY;
const shotstackAssetsUrl = process.env.SHOTSTACK_ASSETS_URL;

const SOUNDTRACKS = {
    palmtrees: "https://feeds.soundcloud.com/stream/499015833-unminus-palmtrees.mp3",
    ambisax: "https://feeds.soundcloud.com/stream/573901050-unminus-ambisax.mp3",
    lit: "https://feeds.soundcloud.com/stream/554074383-unminus-lit.mp3"
}

const LUMA_ASSETS = [
    "https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/luma-mattes/melts/melting-center.mp4",
];

const EFFECTS = [
    "zoomInSlow", "slideUpSlow", "slideLeftSlow", "zoomOutSlow", "slideDownSlow", "slideRightSlow"
]

const pexelsClient = pexels.createClient(process.env.PEXELS_API_KEY);

module.exports.submit = (data) => {
    const schema = {
        search: Joi.string().regex(/^[a-zA-Z0-9 ]*$/).min(2).max(30).required(),
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

        const minClips = 4;
        const maxClips = 6;
        const clipLength = 4;
        const lumaLength = 2;
        const titleLength = 3;
        
        pexelsClient.photos.search({query: data.search, per_page: maxClips, orientation:'landscape'}).then(responce => {
            if (responce.total_results < minClips) {
                throw "There are not enough images for '" + data.search + "' to create a video";
            }
            const images = responce.photos.entries();
            const tracks = [];
            
            const title = {
                clips: [
                    {
                        asset: {
                            type: "title",
                            text: data.title,
                            style: "chunk",
                            size: "small"
                        },
                        start: 0,
                        length: titleLength,
                        effect: "zoomIn",
                        transition: {
                            in: "fade",
                            out: "fade"
                        }
                    }
                ]
            };

            tracks.push(title);

            for (const [index, image] of images) {
                const imageSrc = image.src.original;
                const isLastClip = index === (maxClips - 1);
                const newClipStartTime = titleLength + (index * clipLength) - index * lumaLength;
                const imageAsset = {
                    asset: {
                        type: "image",
                        src: imageSrc
                    },
                    start: newClipStartTime,
                    length: clipLength,
                    effect: EFFECTS[index%EFFECTS.length]
                }
            
                if (index === 0) {
                    imageAsset.transition = {
                        in: "fade"
                    }
                }
                
                if (isLastClip) {           
                    imageAsset.transition = {
                        out: "fade"
                    }
                }

                const clips = [imageAsset];

                if (!isLastClip) {
                    const lumaAsset =  {
                        asset: {
                            type: "luma",
                            src: LUMA_ASSETS[index%LUMA_ASSETS.length],
                        },
                        start: newClipStartTime + clipLength - lumaLength,
                        length: lumaLength
                    }
                    clips.push(lumaAsset);
                }
                
                tracks.push({clips});
            }

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
