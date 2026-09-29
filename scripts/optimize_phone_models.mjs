// Slim the Work section's phone models for the web (run from scripts/'s
// sibling folder with @gltf-transform/core, /extensions, /functions and
// sharp installed):
//   node scripts/optimize_phone_models.mjs in.glb out.glb <displayMeshName>
// - drops the display's own textures (the site paints each project's
//   screenshot there at runtime, so the model's wallpaper is dead weight)
// - caps every texture at 512px (the phones render ~300px wide) as WebP
// - dedups/prunes (keeping vertex attributes), and quantizes meshes (no
//   decoder needed)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress, quantize } from '@gltf-transform/functions';
import sharp from 'sharp';

const [, , input, output, displayName] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);

const display = doc.getRoot().listMeshes().find(m => m.getName() === displayName)
  || doc.getRoot().listNodes().find(n => n.getName() === displayName)?.getMesh();
if (!display) throw new Error('display mesh not found: ' + displayName);
for (const prim of display.listPrimitives()) {
  const mat = prim.getMaterial();
  if (!mat) continue;
  const plain = mat.clone().setName((mat.getName() || 'display') + '_plain');
  plain.setBaseColorTexture(null).setEmissiveTexture(null).setEmissiveFactor([0, 0, 0])
    .setNormalTexture(null).setOcclusionTexture(null).setMetallicRoughnessTexture(null);
  prim.setMaterial(plain);
}

// keepAttributes: the display's material no longer references a texture,
// but its UVs are exactly what the runtime screenshot needs.
await doc.transform(
  dedup(),
  prune({ keepAttributes: true }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 88 }),
  quantize(),
  prune({ keepAttributes: true })
);
await io.write(output, doc);
console.log('wrote', output);
