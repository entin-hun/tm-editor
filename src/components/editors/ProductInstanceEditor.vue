<template>
  <q-card class="q-my-md">
    <q-expansion-item :label="$props.label" default-opened>
      <div class="q-pa-md">
        <q-select
          label="category"
          :options="instanceCategories"
          v-model="instanceCategory"
        />
        <FoodInstanceEditor v-if="value.category === 'food'" v-model="value" />
        <CartridgeInstanceEditor
          v-model="value"
          v-else-if="value.category === 'cartridge'"
        />
        <PriceEditor
          v-if="'price' in value"
          v-model="value.price"
          label="price"
        />
      </div>
    </q-expansion-item>
  </q-card>
</template>

<script setup lang="ts">
import { Priced, ProductInstance } from '@fairfooddata/types';
import { ref, watch } from 'vue';
import FoodInstanceEditor from './FoodInstanceEditor.vue';
import CartridgeInstanceEditor from './CartridgeInstanceEditor.vue';
import {
  clone,
  defaultCartridgeInstance,
  defaultFoodInstance,
  defaultPricedProductInstance,
  defaultProductInstance,
} from './defaults';
import PriceEditor from './PriceEditor.vue';

const props = defineProps<{
  modelValue: ProductInstance | Priced<ProductInstance> | undefined;
  label: string;
  priced: boolean;
}>();

const instanceCategories = ['food', 'cartridge'];

const value = ref<ProductInstance | Priced<ProductInstance>>(
  props.modelValue ??
    (props.priced
      ? clone(defaultPricedProductInstance)
      : clone(defaultProductInstance))
);

const instanceCategory = ref(value.value.category);

const productInstanceFactory: { [type: string]: ProductInstance } = {
  food: defaultFoodInstance,
  cartridge: defaultCartridgeInstance,
};

watch(
  instanceCategory,
  (newValue) => (value.value = clone(productInstanceFactory[newValue]))
);
</script>
