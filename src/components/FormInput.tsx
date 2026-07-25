import type { FC } from "hono/jsx";

type FormInputProps = {
  label: string;
  name: string;
  type?: string;
  value?: string;
  placeholder?: string;
  required?: boolean;
  autofocus?: boolean;
};

export const FormInput: FC<FormInputProps> = ({
  label,
  name,
  type = "text",
  value,
  placeholder,
  required,
  autofocus,
}) => {
  return (
    <label class="block mb-4">
      <span class="gt-label">{label}</span>
      <input
        type={type}
        name={name}
        value={value}
        placeholder={placeholder}
        required={required}
        autofocus={autofocus}
        class="gt-input"
      />
    </label>
  );
};
