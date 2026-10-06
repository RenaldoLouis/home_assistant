import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { PrivacyTransparencyModal } from '../src/components/PrivacyTransparencyModal';

describe('PrivacyTransparencyModal', () => {
  it('renders modal content when visible', () => {
    const handleClose = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <PrivacyTransparencyModal visible={true} onClose={handleClose} />,
      );
    });

    const root = renderer!.root;
    expect(
      root.findAll(node => typeof node.props?.children === 'string' && node.props.children.includes('Privacy & Transparency')).length,
    ).toBeGreaterThan(0);

    expect(
      root.findAll(node => typeof node.props?.children === 'string' && node.props.children.includes('Whitelisted Apps Only')).length,
    ).toBeGreaterThan(0);

    expect(
      root.findAll(node => typeof node.props?.children === 'string' && node.props.children.includes('OTP & Credential Kill-Switch')).length,
    ).toBeGreaterThan(0);

    const closeBtn = root.findByProps({ testID: 'close-privacy-modal' });
    expect(closeBtn).toBeTruthy();

    act(() => {
      closeBtn.props.onPress();
    });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('toggles whitelisted app list on click', () => {
    const handleClose = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <PrivacyTransparencyModal visible={true} onClose={handleClose} />,
      );
    });

    const root = renderer!.root;
    const toggleBtn = root.findByProps({ testID: 'toggle-whitelisted-apps' });

    // Initially collapsed
    expect(
      root.findAll(node => typeof node.props?.children === 'string' && node.props.children === 'id.co.bca.mybca').length,
    ).toBe(0);

    // Expand
    act(() => {
      toggleBtn.props.onPress();
    });

    expect(
      root.findAll(node => typeof node.props?.children === 'string' && node.props.children === 'id.co.bca.mybca').length,
    ).toBeGreaterThan(0);

    // Collapse again
    act(() => {
      toggleBtn.props.onPress();
    });

    expect(
      root.findAll(node => typeof node.props?.children === 'string' && node.props.children === 'id.co.bca.mybca').length,
    ).toBe(0);
  });
});
