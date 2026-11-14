import { render, screen } from '@testing-library/react';
import React from 'react';
import { PrimaryButton } from './PrimaryButton';

describe('PrimaryButton', () => {
  it('renders label correctly', () => {
    render(<PrimaryButton label="Submit Form" />);
    expect(screen.getByText('Submit Form')).toBeDefined();
  });
});
