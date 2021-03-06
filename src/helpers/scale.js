import { flatten, includes, isFunction } from "lodash";
import { Collection, Helpers } from "victory-core";
import d3Scale from "d3-scale";

const supportedScaleStrings = ["linear", "time", "log", "sqrt"];

export default {

  getDefaultScale() {
    return d3Scale.scaleLinear();
  },

  toNewName(scale) {
    // d3 scale changed the naming scheme for scale from "linear" -> "scaleLinear" etc.
    const capitalize = (s) => s && s[0].toUpperCase() + s.slice(1);
    return `scale${capitalize(scale)}`;
  },

  validScale(scale) {
    if (typeof scale === "function") {
      return (isFunction(scale.copy) && isFunction(scale.domain) && isFunction(scale.range));
    } else if (typeof scale === "string") {
      return includes(supportedScaleStrings, scale);
    }
    return false;
  },

  isScaleDefined(props, axis) {
    if (!props.scale) {
      return false;
    } else if (props.scale.x || props.scale.y) {
      return props.scale[axis] ? true : false;
    }
    return true;
  },

  getScaleFromProps(props, axis) {
    if (!this.isScaleDefined(props, axis)) {
      return undefined;
    }
    const scale = props.scale[axis] || props.scale;
    if (this.validScale(scale)) {
      return isFunction(scale) ? scale : d3Scale[this.toNewName(scale)]();
    }
  },

  getScaleTypeFromData(props, axis) {
    if (!props.data) {
      return "linear";
    }
    const accessor = Helpers.createAccessor(props[axis]);
    const allData = flatten(props.data);
    const axisData = allData.map(accessor);
    return Collection.containsDates(axisData) ? "time" : "linear";
  },

  getBaseScale(props, axis) {
    const scale = this.getScaleFromProps(props, axis);
    if (scale) {
      return scale;
    }
    const dataScale = this.getScaleTypeFromData(props, axis);
    return d3Scale[this.toNewName(dataScale)]();
  },

  getScaleType(props, axis) {
    const scale = this.getScaleFromProps(props, axis);
    // if the scale was not given in props, it will be set to linear or time depending on data
    if (!scale) {
      return this.getScaleTypeFromData(props, axis);
    } else if (typeof scale === "string") {
      return includes(supportedScaleStrings, scale) ? scale : "invalid";
    } else if (!this.validScale(scale)) {
      return "invalid";
    }
    const duckTypes = [
      {name: "log", method: "base"},
      {name: "ordinal", method: "unknown"},
      {name: "pow-sqrt", method: "exponent"},
      {name: "quantile", method: "quantiles"},
      {name: "quantize-threshold", method: "invertExtent"}
    ];
    const scaleType = duckTypes.filter((type) => {
      return scale[type.method] !== undefined;
    })[0];
    if (scaleType) {
      return scaleType.name;
    }
    return this.getScaleTypeFromData(props, axis);
  }
};
