'use client';

import { useState } from 'react';
import { BorrowerProfile } from '@/types/lending';

interface BorrowerFormProps {
  onSubmit: (profile: BorrowerProfile) => void;
  isLoading?: boolean;
}

const TENURE_OPTIONS = [
  { value: 12, label: '12 months' },
  { value: 24, label: '24 months' },
  { value: 36, label: '36 months' },
  { value: 48, label: '48 months' },
  { value: 60, label: '60 months' },
];

export const BorrowerForm = ({ onSubmit, isLoading = false }: BorrowerFormProps) => {
  const [formData, setFormData] = useState<Partial<BorrowerProfile>>({
    fullName: '',
    creditScore: 700,
    requiredAmount: 500000,
    tenureMonths: 60,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName?.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!formData.creditScore || formData.creditScore < 300 || formData.creditScore > 900) {
      newErrors.creditScore = 'Credit score must be between 300 and 900';
    }

    if (!formData.requiredAmount || formData.requiredAmount < 100000) {
      newErrors.requiredAmount = 'Loan amount must be at least ₹1,00,000';
    }

    if (formData.requiredAmount && formData.requiredAmount > 50000000) {
  newErrors.requiredAmount = 'Loan amount cannot exceed ₹5 Crore';
}

    if (!formData.tenureMonths) {
      newErrors.tenureMonths = 'Please select a tenure';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const numericFields = ['creditScore', 'requiredAmount', 'tenureMonths'];

    setFormData((prev) => ({
      ...prev,
      [name]: numericFields.includes(name) ? Number(value) : value,
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    onSubmit({
      id: `borrower_${Date.now()}`,
      fullName: formData.fullName!,
      creditScore: formData.creditScore!,
      requiredAmount: formData.requiredAmount!,
      tenureMonths: formData.tenureMonths!,
      createdAt: new Date(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Full Name Field */}
      <div>
        <label htmlFor="fullName" className="block text-sm font-medium text-slate-200 mb-2">
          Full Name
        </label>
        <input
          id="fullName"
          type="text"
          name="fullName"
          value={formData.fullName}
          onChange={handleChange}
          disabled={isLoading}
          placeholder="Enter your full name"
          className={`w-full px-4 py-3 rounded-lg bg-slate-800 border text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
            errors.fullName ? 'border-red-500' : 'border-slate-700'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        />
        {errors.fullName && (
          <p className="text-red-400 text-sm mt-1">{errors.fullName}</p>
        )}
      </div>

      {/* Credit Score Field */}
      <div>
        <label htmlFor="creditScore" className="block text-sm font-medium text-slate-200 mb-2">
          Credit Score
        </label>
        <div className="flex items-center gap-3">
          <input
            id="creditScore"
            type="number"
            name="creditScore"
            value={formData.creditScore}
            onChange={handleChange}
            disabled={isLoading}
            min="300"
            max="900"
            className={`flex-1 px-4 py-3 rounded-lg bg-slate-800 border text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
              errors.creditScore ? 'border-red-500' : 'border-slate-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          />
          <div className="text-right min-w-fit">
            <div className="text-2xl font-bold text-primary-400">{formData.creditScore}</div>
            <div className="text-xs text-slate-400">
              {/* Replace your current ternary block with this safety fallback */}
{(formData.creditScore ?? 0) >= 750
  ? '🟢 Excellent'
  : (formData.creditScore ?? 0) >= 700
  ? '🟡 Good'
  : '🔴 Standard'} {/* Note: Keep whatever your original final fallback string or closing logic was here */}
            </div>
          </div>
        </div>
        {errors.creditScore && (
          <p className="text-red-400 text-sm mt-1">{errors.creditScore}</p>
        )}
      </div>

      {/* Loan Amount Field */}
      <div>
        <label htmlFor="requiredAmount" className="block text-sm font-medium text-slate-200 mb-2">
          Target Loan Amount (₹)
        </label>
        <div className="relative">
          <span className="absolute left-4 top-3 text-slate-400">₹</span>
          <input
            id="requiredAmount"
            type="number"
            name="requiredAmount"
            value={formData.requiredAmount}
            onChange={handleChange}
            disabled={isLoading}
            min="100000"
            className={`w-full pl-8 pr-4 py-3 rounded-lg bg-slate-800 border text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
              errors.requiredAmount ? 'border-red-500' : 'border-slate-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          />
        </div>
        <div className="text-xs text-slate-400 mt-1">
          {formData.requiredAmount && `₹${(formData.requiredAmount / 100000).toFixed(1)} Lacs`}
        </div>
        {errors.requiredAmount && (
          <p className="text-red-400 text-sm mt-1">{errors.requiredAmount}</p>
        )}
      </div>

      {/* Tenure Dropdown */}
      <div>
        <label htmlFor="tenureMonths" className="block text-sm font-medium text-slate-200 mb-2">
          Desired Tenure
        </label>
        <select
          id="tenureMonths"
          name="tenureMonths"
          value={formData.tenureMonths}
          onChange={handleChange}
          disabled={isLoading}
          className={`w-full px-4 py-3 rounded-lg bg-slate-800 border text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
            errors.tenureMonths ? 'border-red-500' : 'border-slate-700'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <option value="">Select tenure...</option>
          {TENURE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors.tenureMonths && (
          <p className="text-red-400 text-sm mt-1">{errors.tenureMonths}</p>
        )}
      </div>

     

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full px-6 py-3 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
      >
        {isLoading ? 'Processing...' : 'Start Auction & Find Best Rate'}
      </button>
    </form>
  );
};
