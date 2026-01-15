import { defineStore } from 'pinia';
import { DirectListing } from 'thirdweb/extensions/marketplace';

export const useListingsStore = defineStore('listings', {
  state: (): { listings: DirectListing[] } => ({ listings: [] }),
  actions: {
    setAll(listings: DirectListing[]) {
      this.listings.splice(0);
      this.listings.push(...listings);
    },
  },
});
