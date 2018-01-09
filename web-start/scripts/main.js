/**
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

// Initializes ZapChat.
function ZapChat() {
  this.checkSetup();

  // Shortcuts to DOM Elements.
  this.messageList = document.getElementById('messages');
  this.userList = document.getElementById('users');
  this.chatList = document.getElementById('chats');
  this.messageForm = document.getElementById('message-form');
  this.messageInput = document.getElementById('message');
  this.submitButton = document.getElementById('submit');
  this.submitImageButton = document.getElementById('submitImage');
  this.imageForm = document.getElementById('image-form');
  this.mediaCapture = document.getElementById('mediaCapture');
  this.userPic = document.getElementById('user-pic');
  this.userName = document.getElementById('user-name');
  this.createUserButton = document.getElementById('create-user');
  this.forgotPasswordButton = document.getElementById('forgot-password');
  this.signInButton = document.getElementById('sign-in');
  this.signOutButton = document.getElementById('sign-out');
  this.signInSnackbar = document.getElementById('must-signin-snackbar');
  this.loginSection = document.getElementById('login-section');
  this.messageSection = document.getElementById('message-section');
  this.userSection = document.getElementById('user-section');
  this.chatSection = document.getElementById('chat-section');
  this.saveSettingsButton = document.getElementById('save-settings');
  this.settingsButton = document.getElementById('settings');
  this.settingsSection = document.getElementById('settings-section');
  this.startChatForm = document.getElementById('start-chat-form');

  // Button actions
  this.messageForm.addEventListener('submit', this.saveMessage.bind(this));
  this.signOutButton.addEventListener('click', this.signOut.bind(this));
  this.signInButton.addEventListener('click', this.signIn.bind(this));
  this.createUserButton.addEventListener('click', this.createUser.bind(this));
  this.forgotPasswordButton.addEventListener('click', this.forgotPassword.bind(this));
  this.saveSettingsButton.addEventListener('click', this.saveSettings.bind(this));
  this.settingsButton.addEventListener('click', this.showSettings.bind(this));
  this.startChatForm.addEventListener('submit', this.startChat.bind(this));

  // Toggle for the button.
  var buttonTogglingHandler = this.toggleButton.bind(this);
  this.messageInput.addEventListener('keyup', buttonTogglingHandler);
  this.messageInput.addEventListener('change', buttonTogglingHandler);

  // Events for image upload.
  this.submitImageButton.addEventListener('click', function(e) {
    e.preventDefault();
    this.mediaCapture.click();
  }.bind(this));
  this.mediaCapture.addEventListener('change', this.saveImageMessage.bind(this));

  this.initFirebase();

}

// Sets up shortcuts to Firebase features and initiate firebase auth.
ZapChat.prototype.initFirebase = function() {
  // Shortcuts to Firebase SDK features.
  this.auth = firebase.auth();
  this.database = firebase.database();
  this.storage = firebase.storage();
  // Initiates Firebase auth and listen to auth state changes.
  this.auth.onAuthStateChanged(this.onAuthStateChanged.bind(this));
};

// Creates new user 
ZapChat.prototype.createUser = function() {
  var email = document.getElementById('signin-email').value;
  var password = document.getElementById('signin-password').value;
  var authenticated = false;
  this.auth.createUserWithEmailAndPassword(email, password).then(function() {
    // authenticated
  }).catch(function(error) {
    // Handle Errors here.
    var errorCode = error.code;
    var errorMessage = error.message;
    // ...
    alert(errorMessage);
  });
  //this.settingsSection.removeAttribute('hidden');
  //this.saveSettingsButton.removeAttribute('hidden');
  //this.createUserButton.setAttribute('disabled', 'true');
}

// Resets user's password
ZapChat.prototype.forgotPassword = function() {
  var email = document.getElementById('signin-email');
  this.auth.sendPasswordResetEmail(email);
}

// Loads current chats and listens for new ones
ZapChat.prototype.loadChats = function() {
  // Reference to the /chats/ database path.
  this.chatsRef = this.database.ref('/users/' + this.auth.currentUser.uid + '/chats');
  // Make sure we remove all previous listeners.
  this.chatsRef.off();

  // Loads the last 12 messages and listen for new ones.
  var setChat = function(data) {
    var val = data.val();
    this.displayChat(data.key, val.users, val.messages);
  }.bind(this);
  this.chatsRef.on('child_added', setChat);
  this.chatsRef.on('child_changed', setChat);
};

// Loads chat messages history and listens for upcoming ones.
ZapChat.prototype.loadMessages = function(e) {
  e.preventDefault();
  // clear message list 
  this.messageList.innerHTML = '';
  // get chat id from click
  this.chatid = e.target.attributes.chatid.value;
  // set 'active' state 
  $('#chats .chat').removeClass('active');
  $(e.target).addClass('active');
  // add chat id to messagelist
  this.messageList.setAttribute('chatid', this.chatid);
  // reference to current messages db path for specific user and chat id
  this.messagesRef = this.database.ref('users/' + this.auth.currentUser.uid + '/chats/' + this.chatid + '/messages');
  // Make sure we remove all previous listeners.
  this.messagesRef.off();
  // Loads the last 12 messages and listen for new ones.
  var setMessage = function(data, chatid) {
    var val = data.val();
    this.displayMessage(data.key, val.name, val.text, chatid);
  }.bind(this);
  this.messagesRef.limitToLast(12).on('child_added', setMessage);
  this.messagesRef.limitToLast(12).on('child_changed', setMessage);
};

// Loads current users and listens for new ones
ZapChat.prototype.loadUsers = function() {
  // Reference to the /users/ database path.
  this.usersRef = this.database.ref('users');
  // Make sure we remove all previous listeners.
  this.usersRef.off();

  // Loads the last 12 messages and listen for new ones.
  var setUser = function(data) {
    var val = data.val();
    if(data.key != this.auth.currentUser.uid){
      this.displayUser(data.key, val.email);
    }
  }.bind(this);
  this.usersRef.on('child_added', setUser);
  this.usersRef.on('child_changed', setUser);
};

// Saves a new message on the Firebase DB.
ZapChat.prototype.saveMessage = function(e) {
  e.preventDefault();
  console.log(this.chatid);
  // Check that the user entered a message and is signed in.
  if (this.messageInput.value && this.checkSignedInWithMessage()) {
    var currentUser = this.auth.currentUser;
    // Add a new message entry to the Firebase Database for each user in chat
    var chatUserIDs = [];
    firebase.database().ref('/users/' + this.auth.currentUser.uid + '/chats/' + this.chatid).child('users').on('value', function(snapshot) {
      chatUserIDs = snapshotToArray(snapshot);
    });
    for(var i = 0; i < chatUserIDs.length; i++){
      var userMessagesRef = firebase.database().ref('/users/' + chatUserIDs[i] + '/chats/' + this.chatid + '/messages');
      userMessagesRef.push({
        name: currentUser.email,
        text: this.messageInput.value
      }).catch(function(error) {
        console.error('Error writing new message to Firebase Database', error);
      });
    }
    // add a new message entry to the firebase database for the current user
    this.messagesRef.push({
      name: currentUser.email,
      text: this.messageInput.value
    }).then(function() {
      // Clear message text field and SEND button state.
      ZapChat.resetMaterialTextfield(this.messageInput);
      this.toggleButton();
    }.bind(this)).catch(function(error) {
      console.error('Error writing new message to Firebase Database', error);
    });
  }
};

// Sets the URL of the given img element with the URL of the image stored in Cloud Storage.
ZapChat.prototype.setImageUrl = function(imageUri, imgElement) {
  imgElement.src = imageUri;

  // If the image is a Cloud Storage URI we fetch the URL.
  if (imageUri.startsWith('gs://')) {
    imgElement.src = FriendlyChat.LOADING_IMAGE_URL; // Display a loading image first.
    this.storage.refFromURL(imageUri).getMetadata().then(function(metadata) {
      imgElement.src = metadata.downloadURLs[0];
    });
  } else {
    imgElement.src = imageUri;
  }
};

// Saves a new message containing an image URI in Firebase.
// This first saves the image in Firebase storage.
ZapChat.prototype.saveImageMessage = function(event) {
  event.preventDefault();
  var file = event.target.files[0];

  // Clear the selection in the file picker input.
  this.imageForm.reset();

  // Check if the file is an image.
  if (!file.type.match('image.*')) {
    var data = {
      message: 'You can only share images',
      timeout: 2000
    };
    this.signInSnackbar.MaterialSnackbar.showSnackbar(data);
    return;
  }

  // Check if the user is signed-in
  if (this.checkSignedInWithMessage()) {

    // We add a message with a loading icon that will get updated with the shared image.
    var currentUser = this.auth.currentUser;
    this.messagesRef.push({
      name: currentUser.displayName,
      imageUrl: FriendlyChat.LOADING_IMAGE_URL,
      photoUrl: currentUser.photoURL || '/images/profile_placeholder.png'
    }).then(function(data) {

      // Upload the image to Cloud Storage.
      var filePath = currentUser.uid + '/' + data.key + '/' + file.name;
      return this.storage.ref(filePath).put(file).then(function(snapshot) {

        // Get the file's Storage URI and update the chat message placeholder.
        var fullPath = snapshot.metadata.fullPath;
        return data.update({imageUrl: this.storage.ref(fullPath).toString()});
      }.bind(this));
    }.bind(this)).catch(function(error) {
      console.error('There was an error uploading a file to Cloud Storage:', error);
    });
  }
};

// save settings for zap chat user
ZapChat.prototype.saveSettings = function() {
  var displayName = document.getElementById('display-name');
  var photo = null; // TODO
  var user = this.auth.currentUser;
  this.auth.currentUser.updateProfile({ // <-- Update Method here
    displayName: displayName,
    photoURL: photo || '/images/profile_placeholder.png'
  }).then(function() {
    // Profile updated successfully!
    document.getElementById('user-name').value = user.displayName;
    var photoURL = user.photoURL;
  }, function(error) {
    console.log(error);
  });
  this.loginSection.setAttribute('hidden', 'true');
  this.messageSection.removeAttribute('hidden');  
}
// secondary save settings call from header
ZapChat.prototype.showSettings = function() {
  // hide and unhide everything 
  this.loginSection.removeAttribute('hidden');
  this.settingsSection.removeAttribute('hidden');
  this.saveSettingsButton.removeAttribute('hidden');
  this.messageSection.setAttribute('hidden', 'true');
  document.getElementById('signin-email').setAttribute('disabled', 'true');
  document.getElementById('signin-password').setAttribute('disabled', 'true');
  document.getElementById('sign-in').setAttribute('hidden', 'true');
  document.getElementById('create-user').setAttribute('hidden', 'true');
  document.getElementById('forgot-password').setAttribute('hidden', 'true');
}

// Signs-in Zap Chat.
ZapChat.prototype.signIn = function() {
  // Sign in Firebase using popup auth and Google as the identity provider.
  //var provider = new firebase.auth.GoogleAuthProvider();
  //this.auth.signInWithPopup(provider);
  var email = document.getElementById('signin-email').value;
  var password = document.getElementById('signin-password').value;
  this.auth.signInWithEmailAndPassword(email, password).then( function() {

  }).catch(function(error) {
    // Handle Errors here.
    var errorCode = error.code;
    var errorMessage = error.message;
    // ...
    alert(errorMessage);
  });
};

// Signs-out of Zap Chat.
ZapChat.prototype.signOut = function() {
  // Sign out of Firebase.
  this.auth.signOut();
  document.getElementById('signin-email').removeAttribute('disabled');
  document.getElementById('signin-password').removeAttribute('disabled');
  document.getElementById('sign-in').removeAttribute('hidden');
  document.getElementById('create-user').removeAttribute('hidden');
  document.getElementById('forgot-password').removeAttribute('hidden');
};

// start a new zap chat
ZapChat.prototype.startChat = function(e) {
  e.preventDefault();
  var selectedUsersIds = [];
  var u = 0;
  $('#users input:checkbox').each(function () {
      if(this.checked){
        selectedUsersIds[u] = $(this).val();
        u++;
      }
  });
  var chatID = this.auth.currentUser.uid;
  var currentID = this.auth.currentUser.uid;
  var thisUser = this.auth.currentUser.uid;
  var chatNameInput = document.getElementById('chat_name');
  // create chat ID
  for(var i = 0; i < selectedUsersIds.length; i++){
    chatID += selectedUsersIds[i];
  }
  for(var i = -1; i < selectedUsersIds.length; i++){
    // do current user id first, then all selected ids
    if(i >= 0) currentID = selectedUsersIds[i];
    // get all chats for specified user
    var userChats = firebase.database().ref('users/' + currentID + '/chats');
    // add each of the selected users ids to a single chatid and to a list of users
    var j = 0, k = 0;
    var usersInChat = [];
    if(currentID != thisUser) {
      usersInChat[j] = thisUser;
      j++;
    }
    while(k < selectedUsersIds.length){
      if(selectedUsersIds[k] != currentID){
        usersInChat[j] = selectedUsersIds[k];
        j++;
      }
      k++;
    }
    // add chat id and users to user's chat list
    userChats.child(chatID).once('value', function(snapshot) {
      var exists = (snapshot.val() !== null);
      if(!exists){
        userChats.child(chatID).set({
          users: usersInChat,
          chatName: chatNameInput.value
        });
      }
      else if(exists){
        userChats.child(chatID).update({
          chatName: chatNameInput.value
        });
      }
    });
  }
  // reset checkboxes and chat name fields
  chatNameInput.value = '';
  $('#users input:checkbox').each(function () {
      this.checked = false;
  });
};

// Triggers when the auth state change for instance when the user signs-in or signs-out.
ZapChat.prototype.onAuthStateChanged = function(user) {
  if (user) { // User is signed in!
    // Get profile pic and user's name from the Firebase user object.
    var usersRef = firebase.database().ref('users');
    usersRef.child(user.uid).once('value', function(snapshot) {
      var exists = (snapshot.val() !== null);
      if(!exists){
        usersRef.child(user.uid).set({
          email: user.email,
        });
      }
    });

    var profilePicUrl = user.photoURL;   
    var userName = user.displayName;       

    // Set the user's profile pic and name.
    this.userPic.style.backgroundImage = 'url(' + profilePicUrl + ')';
    this.userName.textContent = userName || user.email;

    // Show user's profile and sign-out button.
    this.userName.removeAttribute('hidden');
    this.userPic.removeAttribute('hidden');
    this.signOutButton.removeAttribute('hidden');
    this.messageSection.removeAttribute('hidden');
    this.userSection.removeAttribute('hidden');
    this.chatSection.removeAttribute('hidden');
    this.settingsButton.removeAttribute('hidden');

    // Hide log-in section.
    this.loginSection.setAttribute('hidden', 'true');

    // We load currently existing chant messages.
    //this.loadMessages();

    // Load users
    this.loadUsers();

    // Load chats
    this.loadChats();

    // We save the Firebase Messaging Device token and enable notifications.
    this.saveMessagingDeviceToken();

  } else { // User is signed out!
    // Hide user's profile and sign-out button.
    this.userName.setAttribute('hidden', 'true');
    this.userPic.setAttribute('hidden', 'true');
    this.signOutButton.setAttribute('hidden', 'true');
    this.messageSection.setAttribute('hidden', 'true');
    this.userSection.setAttribute('hidden', 'true');
    this.chatSection.setAttribute('hidden', 'true');
    this.settingsSection.setAttribute('hidden', 'true');
    this.settingsButton.setAttribute('hidden', 'true');

    // Show sign-in button.
    this.loginSection.removeAttribute('hidden');
  }
};

// Returns true if user is signed-in. Otherwise false and displays a message.
ZapChat.prototype.checkSignedInWithMessage = function() {
  // Return true if the user is signed in Firebase
  if (this.auth.currentUser) {
    return true;
  }

  // Display a message to the user using a Toast.
  var data = {
    message: 'You must sign-in first',
    timeout: 2000
  };
  this.signInSnackbar.MaterialSnackbar.showSnackbar(data);
  return false;
};

// Saves the messaging device token to the datastore.
ZapChat.prototype.saveMessagingDeviceToken = function() {
  firebase.messaging().getToken().then(function(currentToken) {
    if (currentToken) {
      console.log('Got FCM device token:', currentToken);
      // Saving the Device Token to the datastore.
      firebase.database().ref('/fcmTokens').child(currentToken)
          .set(firebase.auth().currentUser.uid);
    } else {
      // Need to request permissions to show notifications.
      this.requestNotificationsPermissions();
    }
  }.bind(this)).catch(function(error){
    console.error('Unable to get messaging token.', error);
  });
};

// Requests permissions to show notifications.
ZapChat.prototype.requestNotificationsPermissions = function() {
  console.log('Requesting notifications permission...');
  firebase.messaging().requestPermission().then(function() {
    // Notification permission granted.
    this.saveMessagingDeviceToken();
  }.bind(this)).catch(function(error) {
    console.error('Unable to get permission to notify.', error);
  });
};

// Resets the given MaterialTextField.
ZapChat.resetMaterialTextfield = function(element) {
  element.value = '';
  element.parentNode.MaterialTextfield.boundUpdateClassesHandler();
};

// Template for messages.
ZapChat.CHAT_TEMPLATE =
    '<div class="chat">' +
    '</div>';

// Displays a Message in the UI.
ZapChat.prototype.displayChat = function(key, chats, messages) {
  //var div = document.getElementById(key);
  //console.log('key = ' + key);
  var div = $('#chats div[chatid=' + key + ']')[0];
  //var div = document.querySelectorAll('[chatid="' + key + '"]');
  // If an element for that message does not exists yet we create it.
  if (!div) {
    var container = document.createElement('div');
    container.innerHTML = ZapChat.CHAT_TEMPLATE;
    div = container.firstChild;
    div.setAttribute('chatid', key);
    div.addEventListener('click', this.loadMessages.bind(this));
    this.chatList.appendChild(div);
  }
  // get list of users in each chat
  var chatUserIDs = [], chatUserEmails = [], chatUsersStr = '', chatName = '';
  firebase.database().ref('/users/' + this.auth.currentUser.uid + '/chats/' + key).on('value', function(snapshot) {
    chatName = snapshot.val().chatName;
  });
  if(chatName == '' || chatName == null){
    firebase.database().ref('/users/' + this.auth.currentUser.uid + '/chats/' + key).child('users').on('value', function(snapshot) {
      chatUserIDs = snapshotToArray(snapshot);
    });
    for(var i=0; i<chatUserIDs.length; i++){
      if(i > 0) chatUsersStr += ', ';
      firebase.database().ref('users/' + chatUserIDs[i]).on("value", function(snapshot) {
        chatUsersStr += snapshot.val().email;
      });
    }
    
    div.innerHTML = chatUsersStr; // .innerHTML = '<button onclick="startChat(' + email + ');">' + email + '</button>';
  }
  else {
    div.innerHTML = chatName;
  }
  // Show the card fading-in.
  setTimeout(function() {div.classList.add('visible')}, 1);
  this.chatList.scrollTop = this.chatList.scrollHeight;
  this.chatList.focus();
};

// function to convert a snapshot to an array
function snapshotToArray(snapshot) {
    var returnArr = [];

    snapshot.forEach(function(childSnapshot) {
        var item = childSnapshot.val();
        returnArr.push(item);
    });

    return returnArr;
};

// Template for messages.
ZapChat.MESSAGE_TEMPLATE =
    '<div class="message-container">' +
      '<div class="spacing"><div class="pic"></div></div>' +
      '<div class="message"></div>' +
      '<div class="name"></div>' +
    '</div>';

// A loading image URL.
ZapChat.LOADING_IMAGE_URL = 'https://www.google.com/images/spin-32.gif';

// Displays a Message in the UI.
ZapChat.prototype.displayMessage = function(key, name, text, chatid) {
  var div = document.getElementById(key);
  // If an element for that message does not exists yet we create it.
  if (!div) {
    var container = document.createElement('div');
    container.innerHTML = ZapChat.MESSAGE_TEMPLATE;
    div = container.firstChild;
    div.setAttribute('id', key);
    this.messageList.appendChild(div);
  }
/*  if (picUrl) {
    div.querySelector('.pic').style.backgroundImage = 'url(' + picUrl + ')';
  }*/
  div.querySelector('.name').textContent = name;
  var messageElement = div.querySelector('.message');
  if (text) { // If the message is text.
    messageElement.textContent = text;
    // Replace all line breaks by <br>.
    messageElement.innerHTML = messageElement.innerHTML.replace(/\n/g, '<br>');
  } /*else if (imageUri) { // If the message is an image.
    var image = document.createElement('img');
    image.addEventListener('load', function() {
      this.messageList.scrollTop = this.messageList.scrollHeight;
    }.bind(this));
    this.setImageUrl(imageUri, image);
    messageElement.innerHTML = '';
    messageElement.appendChild(image);
  }*/
  // Show the card fading-in.
  setTimeout(function() {div.classList.add('visible')}, 1);
  this.messageList.scrollTop = this.messageList.scrollHeight;
  this.messageInput.focus();
};

// Template for messages.
ZapChat.USER_TEMPLATE =
  '<div class="checkbox">' +
  '<label><input type="checkbox" class="user-container"></label>' +
  '</div>';

// Displays a Message in the UI.
ZapChat.prototype.displayUser = function(key, email) {
  var div = $('#users div[uid=' + key + ']')[0];
  // If an element for that message does not exists yet we create it.
  if (!div) {
    var container = document.createElement('div');
    container.innerHTML = ZapChat.USER_TEMPLATE;
    div = container.firstChild;
    div.setAttribute('class', 'checkbox');
    div.setAttribute('uid', key);
    div.innerHTML = '<label><input type="checkbox" class="user-container" value="' +
    key + '">' + email + '</label>';
    this.userList.appendChild(div);
  }

  // Show the card fading-in.
  setTimeout(function() {div.classList.add('visible')}, 1);
  this.userList.scrollTop = this.userList.scrollHeight;
  this.userList.focus();
};

// Enables or disables the submit button depending on the values of the input
// fields.
ZapChat.prototype.toggleButton = function() {
  if (this.messageInput.value) {
    this.submitButton.removeAttribute('disabled');
  } else {
    this.submitButton.setAttribute('disabled', 'true');
  }
};

// Checks that the Firebase SDK has been correctly setup and configured.
ZapChat.prototype.checkSetup = function() {
  if (!window.firebase || !(firebase.app instanceof Function) || !firebase.app().options) {
    window.alert('You have not configured and imported the Firebase SDK. ' +
        'Make sure you go through the codelab setup instructions and make ' +
        'sure you are running the codelab using `firebase serve`');
  }
};

window.onload = function() {
  window.zapChat = new ZapChat();
};
