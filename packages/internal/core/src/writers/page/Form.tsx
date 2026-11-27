/** A Form on a web page: semantic `<form>` with form fields, labels, and submit button. */
import { h, type Html, type Style } from "../jsx";
import { linkParts, type LinkValue } from "../../kinds";
import type { Component } from "./context";
import { stackOf } from "./layout";

export const Form: Component = ({ node, placement, classes }) => {
  const { props, style } = node;
  const actionVal = props.action as LinkValue | undefined;
  const action = actionVal ? linkParts(actionVal) : undefined;
  const method = ((props.method as string) ?? "GET").toUpperCase();
  const buttonText = (props.buttonText as string) ?? "Submit";
  const fields = (props.fields as Array<Record<string, unknown>>) ?? [];

  const fieldStyle = (props.fieldStyle as Style) ?? {};
  const labelStyle = (props.labelStyle as Style) ?? {};
  const buttonStyleObj = (props.buttonStyle as Record<string, unknown>) ?? {};
  const { hover: buttonHover, ...buttonStyleRest } = buttonStyleObj;

  const boxedFormStyle: Style = {
    boxSizing: "border-box",
    width: style.width,
    maxWidth: style.maxWidth,
    gap: style.gap,
  };

  const renderField = (field: Record<string, unknown>, index: number) => {
    const type = (field.type as string) ?? "text";
    const name = String(field.name ?? "");
    const label = field.label !== undefined ? String(field.label) : "";
    const placeholder = field.placeholder !== undefined ? String(field.placeholder) : undefined;
    const required = Boolean(field.required);
    const showLabel = field.showLabel !== false;
    const value = field.value !== undefined ? String(field.value) : undefined;
    const options = Array.isArray(field.options) ? (field.options as string[]) : [];
    const fieldId = node.id ? `${node.id}-${name}` : undefined;

    if (type === "hidden") {
      return <input type="hidden" name={name} value={value} />;
    }

    if (type === "checkbox") {
      const isChecked = value === "true" || value === "checked" || field.value === true;
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            name={name}
            id={fieldId}
            required={required}
            checked={isChecked}
            style={fieldStyle}
          />
          {showLabel && label ? (
            <label for={fieldId} style={labelStyle}>
              {label}
            </label>
          ) : null}
        </div>
      );
    }

    let inputElement: Html;
    if (type === "textarea") {
      inputElement = (
        <textarea
          name={name}
          id={fieldId}
          placeholder={placeholder}
          required={required}
          style={[{ boxSizing: "border-box", width: "100%" }, fieldStyle]}
        >
          {value ?? ""}
        </textarea>
      );
    } else if (type === "dropdown") {
      inputElement = (
        <select
          name={name}
          id={fieldId}
          required={required}
          style={[{ boxSizing: "border-box", width: "100%" }, fieldStyle]}
        >
          {placeholder ? (
            <option value="" disabled selected={!value}>
              {placeholder}
            </option>
          ) : null}
          {options.map((opt) => (
            <option value={opt} selected={opt === value}>
              {opt}
            </option>
          ))}
        </select>
      );
    } else {
      const inputType = type === "phone" ? "tel" : type;
      inputElement = (
        <input
          type={inputType}
          name={name}
          id={fieldId}
          placeholder={placeholder}
          required={required}
          value={value}
          style={[{ boxSizing: "border-box", width: "100%" }, fieldStyle]}
        />
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {showLabel && label ? (
          <label for={fieldId} style={labelStyle}>
            {label}
          </label>
        ) : null}
        {inputElement}
      </div>
    );
  };

  return (
    <form
      id={node.id}
      class={classes()}
      action={action?.href}
      method={method}
      target={action?.target}
      rel={action?.target === "_blank" ? "noopener noreferrer" : undefined}
      style={[placement, stackOf(node), boxedFormStyle]}
    >
      {fields.map(renderField)}
      <button
        type="submit"
        style={[{ alignSelf: "flex-start", cursor: "pointer" }, buttonStyleRest as Style]}
        hover={buttonHover as Style}
      >
        {buttonText}
      </button>
    </form>
  );
};
