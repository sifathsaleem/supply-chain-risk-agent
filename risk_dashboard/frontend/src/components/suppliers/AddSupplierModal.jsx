import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Loader2 } from 'lucide-react';
import { COUNTRIES as VALID_COUNTRIES, isValidCountry, getCanonicalCountry } from '../../utils/countries';

export default function AddSupplierModal({ onCancel, onAdd, adding: externalAdding = false, initialData = null, existingSuppliers = [] }) {
  const baseCategories = [
    "Electronics", "Apparel", "Automotive", "Manufacturing", "Semiconductors", 
    "Logistics", "Chemicals", "Raw Materials", "Energy", "Services"
  ];
  const systemCategories = [...new Set(existingSuppliers.map(s => s.category).filter(Boolean))];
  const SUGGESTED_CATEGORIES = systemCategories.length > 0 ? systemCategories.sort() : baseCategories;

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(initialData?.supplier_name || '');
  const [country, setCountry] = useState(initialData?.country || '');
  const [category, setCategory] = useState(initialData?.category || '');
  const [internalAdding, setInternalAdding] = useState(false);

  const adding = externalAdding || internalAdding;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsOpen(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleClose = (callback) => {
    setIsOpen(false);
    setTimeout(() => {
      callback();
    }, 150); // Match --modal-close-dur (150ms)
  };

  // Dropdown visibility states
  const [showCountries, setShowCountries] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  // Validation states
  const [nameError, setNameError] = useState('');
  const [countryError, setCountryError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const countryRef = useRef(null);
  const categoryRef = useRef(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (countryRef.current && !countryRef.current.contains(event.target)) {
        setShowCountries(false);
      }
      if (categoryRef.current && !categoryRef.current.contains(event.target)) {
        setShowCategories(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const validateForm = (n = name, co = country, ca = category, updateErrors = true) => {
    let errors = { name: '', country: '', category: '' };
    let isValid = true;

    // Validate Name
    if (!n.trim()) {
      errors.name = 'Supplier name is required.';
      isValid = false;
    } else if (n.length > 60) {
      errors.name = 'Supplier name must be under 60 characters.';
      isValid = false;
    } else if (existingSuppliers.some(s => s.supplier_name.trim().toLowerCase() === n.trim().toLowerCase())) {
      errors.name = 'A supplier with this name is already monitored.';
      isValid = false;
    }

    // Validate Country
    if (!co.trim() || !isValidCountry(co)) {
      errors.country = 'Please select a valid country.';
      isValid = false;
    }

    // Validate Category
    if (!ca.trim()) {
      errors.category = 'Category is required.';
      isValid = false;
    } else if (ca.length > 40) {
      errors.category = 'Category must be under 40 characters.';
      isValid = false;
    }

    if (updateErrors) {
      setNameError(errors.name);
      setCountryError(errors.country);
      setCategoryError(errors.category);
    }

    return isValid;
  };

  // Helper to clear error when user types
  const handleNameChange = (val) => {
    setName(val);
    if (hasSubmitted) {
      validateForm(val, country, category, true);
    } else {
      setNameError('');
    }
  };

  const handleCountryChange = (val) => {
    setCountry(val);
    if (hasSubmitted) {
      validateForm(name, val, category, true);
    } else {
      setCountryError('');
    }
  };

  const handleCategoryChange = (val) => {
    setCategory(val);
    if (hasSubmitted) {
      validateForm(name, country, val, true);
    } else {
      setCategoryError('');
    }
  };

  const isFormInvalid = hasSubmitted && !validateForm(name, country, category, false);
  const isSavingInProgress = existingSuppliers.some(s => s.state === 'SAVING');
  const isSubmitDisabled = adding || isFormInvalid || isSavingInProgress;
  const buttonText = (adding || isSavingInProgress) ? 'Adding…' : 'Add Supplier';

  const handleSubmit = (e) => {
    e.preventDefault();
    setHasSubmitted(true);
    const isValid = validateForm(name, country, category, true);

    if (!isValid || isSubmitDisabled) return;

    // Normalize country name casing from list
    const matchedCountry = getCanonicalCountry(country.trim()) || country.trim();

    onAdd({
      supplier_name: name.trim(),
      country: matchedCountry,
      category: category.trim()
    });
  };

  // Filter lists ignoring casing and spaces
  const normalizeStr = (str) => (str || '').toLowerCase().replace(/\s+/g, '');
  
  const filteredCountries = VALID_COUNTRIES.filter(c => 
    normalizeStr(c).includes(normalizeStr(country))
  );

  const filteredCategories = SUGGESTED_CATEGORIES.filter(c => 
    c.toLowerCase().startsWith(category.toLowerCase())
  );

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 400,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16
    }}>
      {/* Backdrop */}
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(6px)',
          opacity: isOpen ? 1 : 0,
          transition: 'opacity 250ms ease'
        }} 
        onClick={adding ? null : () => handleClose(onCancel)} 
      />

      {/* Modal Card */}
      <div 
        className={`t-modal ${isOpen ? 'is-open' : 'is-closing'}`}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 440,
          background: '#141313', // Obsidian Deep surface
          border: '1px solid #232222', // Obsidian Deep outline-variant
          borderRadius: 12,
          overflow: 'visible', // Allow dropdowns to render outside
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid #232222'
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Add Supplier</h2>
          <button 
            onClick={internalAdding ? null : () => handleClose(onCancel)} 
            disabled={internalAdding}
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: internalAdding ? 'not-allowed' : 'pointer', 
              color: '#a3a3a3',
              opacity: internalAdding ? 0.4 : 1
            }}
          >
            <X className="w-5.5 h-5.5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            {/* Supplier Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: '#a3a3a3' }}>SUPPLIER NAME</label>
              <input
                type="text"
                disabled={internalAdding}
                readOnly={internalAdding}
                value={name}
                placeholder="e.g. Acme Industries"
                onChange={e => handleNameChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 14px',
                  background: '#121212',
                  border: `1px solid ${nameError ? '#ef4444' : 'rgba(255, 255, 255, 0.15)'}`,
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 13,
                  outline: 'none',
                  opacity: internalAdding ? 0.6 : 1,
                  cursor: internalAdding ? 'not-allowed' : 'text'
                }}
              />
              {nameError && (
                <span style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{nameError}</span>
              )}
            </div>

            {/* Country Dropdown */}
            <div ref={countryRef} style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: '#a3a3a3' }}>COUNTRY</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  disabled={internalAdding}
                  readOnly={internalAdding}
                  value={country}
                  placeholder="e.g. United Kingdom"
                  onFocus={() => !internalAdding && setShowCountries(true)}
                  onChange={e => {
                    handleCountryChange(e.target.value);
                    setShowCountries(true);
                  }}
                  style={{
                    width: '100%',
                    padding: '9px 36px 9px 14px',
                    background: '#121212',
                    border: `1px solid ${countryError ? '#ef4444' : 'rgba(255, 255, 255, 0.15)'}`,
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 13,
                    outline: 'none',
                    opacity: internalAdding ? 0.6 : 1,
                    cursor: internalAdding ? 'not-allowed' : 'text'
                  }}
                />
                <ChevronDown 
                  className="w-4 h-4 text-white/40" 
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none'
                  }} 
                />
              </div>

              {showCountries && !internalAdding && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: '#1f1f1f',
                  border: '1px solid #2d2c2c',
                  borderRadius: 8,
                  maxHeight: 140,
                  overflowY: 'auto',
                  zIndex: 500,
                  marginTop: 4,
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                }}>
                  {filteredCountries.length > 0 ? (
                    filteredCountries.map(c => (
                      <div
                        key={c}
                        onClick={() => {
                          handleCountryChange(c);
                          setShowCountries(false);
                        }}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontSize: 13,
                          color: '#fff',
                          background: 'transparent',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#262626'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {c}
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '8px 12px', fontSize: 13, color: '#a3a3a3' }}>
                      No matching countries
                    </div>
                  )}
                </div>
              )}
              {countryError && (
                <span style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{countryError}</span>
              )}
            </div>

            {/* Category Autocomplete */}
            <div ref={categoryRef} style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: '#a3a3a3' }}>CATEGORY</label>
              <input
                type="text"
                disabled={internalAdding}
                readOnly={internalAdding}
                value={category}
                placeholder="e.g. Manufacturing"
                onFocus={() => !internalAdding && setShowCategories(true)}
                onChange={e => {
                  handleCategoryChange(e.target.value);
                  setShowCategories(true);
                }}
                style={{
                  width: '100%',
                  padding: '9px 14px',
                  background: '#121212',
                  border: `1px solid ${categoryError ? '#ef4444' : 'rgba(255, 255, 255, 0.15)'}`,
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 13,
                  outline: 'none',
                  opacity: internalAdding ? 0.6 : 1,
                  cursor: internalAdding ? 'not-allowed' : 'text'
                }}
              />

              {showCategories && !internalAdding && category.trim().length > 0 && filteredCategories.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: '#1f1f1f',
                  border: '1px solid #2d2c2c',
                  borderRadius: 8,
                  maxHeight: 140,
                  overflowY: 'auto',
                  zIndex: 500,
                  marginTop: 4,
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                }}>
                  {filteredCategories.map(cat => (
                    <div
                      key={cat}
                      onClick={() => {
                        handleCategoryChange(cat);
                        setShowCategories(false);
                      }}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: 13,
                        color: '#fff',
                        background: 'transparent',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#262626'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {cat}
                    </div>
                  ))}
                </div>
              )}
              {categoryError && (
                <span style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{categoryError}</span>
              )}
            </div>

          </div>

          {/* Footer Actions */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            padding: '12px 24px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderTop: '1px solid #232222',
            borderBottomLeftRadius: 12,
            borderBottomRightRadius: 12
          }}>
            <button 
              type="button" 
              disabled={internalAdding}
              onClick={() => handleClose(onCancel)} 
              style={{
                padding: '7px 16px',
                borderRadius: 8,
                background: 'none',
                border: '1px solid #232222',
                color: '#fff',
                fontSize: 13,
                fontWeight: 500,
                cursor: internalAdding ? 'not-allowed' : 'pointer',
                opacity: internalAdding ? 0.5 : 1
              }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitDisabled} 
              style={{
                padding: '7px 16px',
                borderRadius: 8,
                background: isSubmitDisabled ? 'rgba(255, 255, 255, 0.05)' : '#fff',
                border: 'none',
                color: isSubmitDisabled ? 'rgba(255, 255, 255, 0.3)' : '#000',
                fontSize: 13,
                fontWeight: 700,
                cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              {(adding || isSavingInProgress) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {buttonText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
