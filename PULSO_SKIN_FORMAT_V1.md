# PULSO Skin Package Format V1

A PULSO skin is a data-only package. It contains a `skin.json` manifest and local image/vector assets.

## Security rules

- No JavaScript, HTML injection, executable code, or remote scripts.
- No direct Android/native plugin access.
- No network access declared by a skin.
- Actions must use the PULSO action identifiers registered by the player.
- Built-in skin identifiers cannot be replaced by installed packages.

## Manifest

The Red Neon example is located at `assets/skins/red-neon-pack/skin.json`.

The manifest describes identity, theme tokens, asset paths, supported actions, and normalized control positions. Position values use percentages of the target player surface.

## Current implementation boundary

The skin engine can validate and register data manifests in local storage and switch theme/layout identifiers. The full visual layout renderer, secure package file installation from PULSO SKIN STUDIO, owner authentication, and download/update pipeline are not implemented in this delivery.
