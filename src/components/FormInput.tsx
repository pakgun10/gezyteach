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
      <span class="block text-sm font-medium text-slate-700 mb-1">
        {label}
      </span>
      <input
        type={type}
        name={name}
        value={value}
        placeholder={placeholder}
        required={required}
        autofocus={autofocus}
        class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
      />
    </label>
  );
};
