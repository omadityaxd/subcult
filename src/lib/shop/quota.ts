/**
 * eBay's default is 5,000 Browse calls a day per app: stay well under it.
 * Its own module so the doctor can read it without importing the shop
 * server code (that import cycle left it undefined).
 */
export const EBAY_DAILY_CALLS = 4000
