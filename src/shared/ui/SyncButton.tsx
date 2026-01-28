import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

interface SyncButtonProps {
  onPress: () => void;
  isSyncing: boolean;
}

export const SyncButton: React.FC<SyncButtonProps> = ({
  onPress,
  isSyncing,
}) => {
  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      disabled={isSyncing}
      activeOpacity={0.7}
    >
      {isSyncing ? (
        <ActivityIndicator color="#FFF" size="small" />
      ) : (
        <Text style={styles.text}>🔄 Sync</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  text: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
});
