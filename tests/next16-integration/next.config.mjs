// As create-next-app sets it up since Next.js 16: with Cache Components, pages and GET route handlers that read no
// request data are prerendered when the app builds, and the build fails if one reads a random number or the date.
// The image engines (@hyper-elements/react/image's optional peers) load a native module and fonts at run time, which
// Next.js can't bundle: they're required from node_modules as they are.
export default { cacheComponents: true, partialPrefetching: true, serverExternalPackages: ["@resvg/resvg-js", "satori"] };
