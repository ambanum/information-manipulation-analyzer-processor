# prettier-config-ambanum

A Prettier [shareable config](https://prettier.io/docs/en/configuration.html#sharing-configurations)
for projects of ambanum using **[Prettier](https://prettier.io/)**.

## Installation

```
npm install --save-dev prettier-config-ambanum
```

_This is only a shareable configuration. It does not install Prettier, Standard,
ESLint, or any other part of the tool chain._

## Usage

Reference it in `package.json` using the `prettier` property:

```json
{
  "name": "my-projects-name",
  "prettier": "prettier-config-ambanum",
  "devDependencies": {
    "prettier-config-ambanum": "^1.0.0"
  }
}
```
