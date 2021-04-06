'use strict';

const request = require('request');
const Joi = require('@hapi/joi');
const PexelsAPI = require('pexels-api-wrapper');
const pexels = require('pexels');
const shotstackUrl = process.env.SHOTSTACK_HOST;
const shotstackApiKey = process.env.SHOTSTACK_API_KEY;
const shotstackAssetsUrl = process.env.SHOTSTACK_ASSETS_URL;

const LUMA_ASSETS = [
    "https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/luma-mattes/circles/center-double-invert.mp4",
    "https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/luma-mattes/circles/center-double.mp4",
    "https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/luma-mattes/circles/center-small-to-large.mp4",
    "https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/luma-mattes/circles/circle-half-left.mp4",
    "https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/luma-mattes/circles/circle-half-right.mp4",
    "https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/luma-mattes/circles/enter-large-to-small.mp4"
];

const EFFECTS = [
    "zoomIn", "slideUp", "slideLeft", "zoomOut", "slideDown", "slideRight"
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
                const imageAsset = {
                    asset: {
                        type: "image",
                        src: imageSrc
                    },
                    start: titleLength + (index * clipLength),
                    length: clipLength,
                    effect: EFFECTS[index%EFFECTS.length]
                }
                
                if (index === (maxClips - 1)) {           
                    imageAsset.transition = {
                        out: "fade"
                    }
                }
                
                tracks.push({
                    clips: [
                        imageAsset,
                        {
                            asset: {
                                type: "luma",
                                src: LUMA_ASSETS[index%LUMA_ASSETS.length],
                            },
                            start: titleLength + (index * clipLength) + clipLength - 2,
                            length: 2
                        }
                    ]
                });
            }

            const timeline = {
                soundtrack: {
                    src: shotstackAssetsUrl + "music/" + data.soundtrack + ".mp3",
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
