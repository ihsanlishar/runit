
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

type Props = {
  displayName: string;
  onEditProfile: () => void;
  onSignOut: () => void;
};

export default function HomeScreen({
  displayName,
  onEditProfile,
  onSignOut,
}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>RunIt 🏀</Text>
      <Text style={styles.welcome}>
        Welcome, {displayName}!
      </Text>

      <Text style={styles.subtitle}>
        No organizer. Just play.
      </Text>

      <Text style={styles.message}>
        Your profile is ready. Game matching is coming next.
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={onEditProfile}
      >
        <Text style={styles.buttonText}>Edit Profile</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.signOutButton}
        onPress={onSignOut}
      >
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 28,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: '#16A34A',
    marginBottom: 20,
  },
  welcome: {
    fontSize: 27,
    fontWeight: '700',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 30,
  },
  message: {
    fontSize: 15,
    color: '#444444',
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#16A34A',
    padding: 17,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
  },
  signOutButton: {
    backgroundColor: '#222222',
    padding: 17,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
