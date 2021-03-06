import { assign, defaults, uniq } from "lodash";
import { Helpers, Collection } from "victory-core";
import Scale from "./scale";
import React from "react";

export default {
  // String Data
  createStringMap(props, axis, hasMultipleDatasets = false) {
    const stringsFromAxes = this.getStringsFromAxes(props, axis);
    const stringsFromCategories = this.getStringsFromCategories(props, axis);
    const stringsFromData = hasMultipleDatasets ?
      props.data.reduce((prev, dataset) => {
        return prev.concat(Helpers.getStringsFromData(defaults({}, {data: dataset}, props), axis));
      }, [])
      : this.getStringsFromData(props, axis);

    const allStrings = uniq([...stringsFromAxes, ...stringsFromCategories, ...stringsFromData]);
    return allStrings.length === 0 ? null :
      allStrings.reduce((memo, string, index) => {
        memo[string] = index + 1;
        return memo;
      }, {});
  },

  getStringsFromAxes(props, axis) {
    if (!props.tickValues || (!Array.isArray(props.tickValues) && !props.tickValues[axis])) {
      return [];
    }
    const tickValueArray = props.tickValues[axis] || props.tickValues;
    return tickValueArray.filter((val) => typeof val === "string");
  },

  getStringsFromCategories(props, axis) {
    const childComponents = props.children && React.Children.toArray(props.children);
    if (!props.categories && !props.children) {
      return [];
    }

    const getCategoryStrings = (childProps) => {
      const categories = this.getCategories(childProps, axis);
      return categories && categories.filter((val) => typeof val === "string");
    };

    const categories = props.categories ?
      getCategoryStrings(props) : childComponents.map((child) => getCategoryStrings(child.props));

    return categories ? Collection.removeUndefined(categories) : [];
  },

  getCategories(props, axis) {
    if (!props.categories) {
      return undefined;
    }
    return Array.isArray(props.categories) ? props.categories : props.categories[axis];
  },

  getStringsFromData(props, axis) {
    const childComponents = props.children && React.Children.toArray(props.children);
    if (!props.data && !props.children) {
      return [];
    }

    const getStrings = (childProps) => {
      const accessor = Helpers.createAccessor(
        typeof childProps[axis] !== "undefined" ? childProps[axis] : axis
      );
      return childProps.data ? childProps.data.reduce((prev, curr) => {
        const datum = accessor(curr);
        return typeof datum === "string" && prev.indexOf(datum) === -1 ? prev.concat(datum) : prev;
      }, []) : undefined;
    };

    return props.data ?
      getStrings(props) : childComponents.map((child) => getStrings(child.props));
  },

  // for components that take single datasets
  getData(props) {
    if (props.data) {
      return this.formatData(props.data, props);
    }
    const data = this.generateData(props);
    return this.formatData(data, props);
  },


  generateData(props) {
    // create an array of values evenly spaced across the x domain that include domain min/max
    const domain = props.domain ? (props.domain.x || props.domain) :
      Scale.getBaseScale(props, "x").domain();
    const samples = props.samples || 1;
    const max = Math.max(...domain);
    const values = Array(...Array(samples)).map((val, index) => {
      const v = (max / samples) * index + Math.min(...domain);
      return { x: v, y: v };
    });
    return values[samples - 1].x === max ? values : values.concat([{ x: max, y: max }]);
  },

  formatData(dataset, props, stringMap) {
    if (!dataset) {
      return [];
    }
    stringMap = stringMap || {
      x: this.createStringMap(props, "x"),
      y: this.createStringMap(props, "y")
    };
    const accessor = {
      x: Helpers.createAccessor(props.x),
      y: Helpers.createAccessor(props.y)
    };
    return this.cleanData(dataset, props).map((datum) => {
      const x = accessor.x(datum);
      const y = accessor.y(datum);
      return assign(
          {},
          datum,
          { x, y },
          // map string data to numeric values, and add names
          typeof x === "string" ? { x: stringMap.x[x], xName: x } : {},
          typeof y === "string" ? { y: stringMap.y[y], yName: y } : {}
        );
    });
  },

  cleanData(dataset, props) {
    // Some scale types break when certain data is supplies. This method will
    // remove data points that break scales. So far this method only removes
    // zeroes for log scales
    // TODO other cases?
    const scaleType = {
      x: Scale.getScaleType(props, "x"),
      y: Scale.getScaleType(props, "y")
    };
    const accessor = {
      x: Helpers.createAccessor(props.x),
      y: Helpers.createAccessor(props.y)
    };
    if (scaleType.x !== "log" && scaleType.y !== "log") {
      return dataset;
    }
    const rules = (datum, axis) => {
      return scaleType[axis] === "log" ? accessor[axis](datum) !== 0 : true;
    };
    return dataset.filter((datum) => {
      return rules(datum, "x") && rules(datum, "y");
    });
  }
};
