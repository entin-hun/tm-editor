<template>
  <q-card class="q-my-md" dark>
    <q-expansion-item :label="$props.label" default-opened>
      <div class="q-pa-md">
        <div class="row items-end q-gutter-sm">
          <div class="col">
            <BasicInput
              v-model.number="value.coordinates[0]"
              label="longitude"
              :default-value="0"
              type="number"
            />
          </div>
          <div class="col">
            <BasicInput
              v-model.number="value.coordinates[1]"
              label="latitude"
              :default-value="0"
              type="number"
            />
          </div>
          <q-btn
            :label="showMap ? 'Hide Map' : 'Show Map'"
            @click="toggleMap"
            icon="map"
            color="primary"
            outline
          />
        </div>
        <div v-if="showMap" class="q-mt-md">
          <div ref="mapContainer" style="width: 100%; height: 400px"></div>
          <div class="q-mt-xs text-caption text-grey-7">
            Click on the map to set location
          </div>
        </div>
      </div>
    </q-expansion-item>
  </q-card>
</template>

<script setup lang="ts">
import { Location } from '@trace.market/types';
import BasicInput from './BasicInput.vue';
import { clone, defaultLocation } from './defaults';
import { ref, watch, nextTick, onBeforeUnmount } from 'vue';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';

// Get Mapbox access token from environment variable
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

const props = defineProps<{
  modelValue: Location | undefined;
  label: string;
}>();

const value = ref(props.modelValue ?? clone(defaultLocation));
const showMap = ref(false);
const mapContainer = ref<HTMLElement>();
let map: mapboxgl.Map | null = null;
let marker: mapboxgl.Marker | null = null;

const emit = defineEmits(['update:modelValue']);

watch(
  value,
  (newValue) => {
    emit('update:modelValue', newValue);
  },
  { deep: true }
);

// Update internal state when parent replaces the object (e.g., JSON editor)
watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal !== value.value) {
      value.value = newVal ?? clone(defaultLocation);
    }
  }
);

async function toggleMap() {
  showMap.value = !showMap.value;

  if (showMap.value) {
    await nextTick();
    initMap();
  } else {
    destroyMap();
  }
}

function initMap() {
  if (!mapContainer.value) return;

  const [lng, lat] = value.value.coordinates;

  map = new mapboxgl.Map({
    container: mapContainer.value,
    style: 'mapbox://styles/mapbox/satellite-streets-v12',
    center: [lng || 0, lat || 0],
    zoom: lng && lat ? 10 : 1,
  });

  // Add geocoder (address search)
  const geocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    marker: false,
    placeholder: 'Search for an address',
  });

  map.addControl(geocoder);

  // Handle geocoder result
  geocoder.on('result', (e) => {
    const coords = e.result.geometry.coordinates;
    value.value.coordinates = [coords[0], coords[1]];

    if (!map) return;

    // Update or create marker
    if (marker) {
      marker.setLngLat(coords);
    } else {
      marker = new mapboxgl.Marker({ draggable: true })
        .setLngLat(coords)
        .addTo(map);

      marker.on('dragend', () => {
        if (!marker) return;
        const lngLat = marker.getLngLat();
        value.value.coordinates = [lngLat.lng, lngLat.lat];
      });
    }
  });

  // Add marker at current location
  if (lng && lat) {
    marker = new mapboxgl.Marker({ draggable: true })
      .setLngLat([lng, lat])
      .addTo(map);

    marker.on('dragend', () => {
      if (!marker) return;
      const lngLat = marker.getLngLat();
      value.value.coordinates = [lngLat.lng, lngLat.lat];
    });
  }

  // Click to set location
  map.on('click', (e) => {
    value.value.coordinates = [e.lngLat.lng, e.lngLat.lat];

    if (!map) return;

    // Update or create marker
    if (marker) {
      marker.setLngLat([e.lngLat.lng, e.lngLat.lat]);
    } else {
      marker = new mapboxgl.Marker({ draggable: true })
        .setLngLat([e.lngLat.lng, e.lngLat.lat])
        .addTo(map);

      marker.on('dragend', () => {
        if (!marker) return;
        const lngLat = marker.getLngLat();
        value.value.coordinates = [lngLat.lng, lngLat.lat];
      });
    }
  });

  // Add navigation controls
  map.addControl(new mapboxgl.NavigationControl(), 'top-right');
}

function destroyMap() {
  if (marker) {
    marker.remove();
    marker = null;
  }
  if (map) {
    map.remove();
    map = null;
  }
}

onBeforeUnmount(() => {
  destroyMap();
});
</script>
