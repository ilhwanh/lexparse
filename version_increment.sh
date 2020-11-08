VERSION=$(cat package.json | jq -r '.version')
MAJOR=$(echo $VERSION | cut -f 1 -d '.')
MINOR=$(echo $VERSION | cut -f 2 -d '.')
BUILD=$(echo $VERSION | cut -f 3 -d '.')
BUILD_NEXT=$(let "a = $BUILD + 1" && echo $a)
VERSION_NEXT=$(echo "$MAJOR.$MINOR.$BUILD_NEXT")

echo "next version is"
echo " " $VERSION_NEXT
echo ""

mv package.json package.json.old
cat package.json.old | jq ".version = \"$VERSION_NEXT\" | ." > package.json
